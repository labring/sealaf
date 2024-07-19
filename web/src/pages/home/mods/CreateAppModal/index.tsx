import { cloneElement, ReactElement, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Button,
  FormControl,
  FormErrorMessage,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useDisclosure,
  VStack,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { t } from "i18next";
import _ from "lodash";

import { APP_STATUS } from "@/constants/index";

import { APP_LIST_QUERY_KEY } from "../..";
import { queryKeys } from "../../service";

import AutoscalingControl, { TypeAutoscaling } from "./AutoscalingControl";
import BundleControl from "./BundleControl";
import DatabaseBundleControl from "./DatabaseBundleControl";

import { TApplicationItem, TBundle } from "@/apis/typing";
import {
  ApplicationControllerCreate,
  ApplicationControllerUpdateBundle,
  ApplicationControllerUpdateName,
} from "@/apis/v1/applications";
import { ResourceControllerGetResourceOptions } from "@/apis/v1/resources";
import useGlobalStore from "@/pages/globalStore";

type FormData = {
  name: string;
  state: APP_STATUS | string;
  regionId: string;
  runtimeId: string;
  bundleId: string;
};

export type TypeBundle = {
  cpu: number;
  memory: number;
  dedicatedDatabase?: {
    cpu: number;
    memory: number;
    capacity: number;
    replicas: number;
  };
};

const CreateAppModal = (props: {
  type: "create" | "edit" | "change";
  application?: TApplicationItem;
  children: ReactElement;
  isCurrentApp?: boolean;
}) => {
  const { application, type, isCurrentApp } = props;
  const { isOpen, onOpen, onClose } = useDisclosure();
  const queryClient = useQueryClient();
  const {
    runtimes = [],
    regions = [],
    showSuccess,
    currentApp,
    setCurrentApp,
    updateCurrentApp,
  } = useGlobalStore();

  const title = useMemo(
    () => (type === "edit" ? t("Edit") : type === "change" ? t("Change") : t("CreateApp")),
    [type],
  );

  const currentRegion = useMemo(
    () => regions.find((item: any) => item._id === application?.regionId) || regions[0],
    [regions, application],
  );

  const sortedBundles = useMemo(
    () =>
      [...currentRegion.bundles].sort(
        (a: TBundle, b: TBundle) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [currentRegion.bundles],
  );

  let defaultValues = {
    name: application?.name || "",
    state: application?.state || APP_STATUS.Running,
    regionId: application?.regionId || regions[0]._id,
    runtimeId: runtimes[0]._id,
    bundleId: sortedBundles[0]._id,
  };

  const {
    register,
    handleSubmit,
    setFocus,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues,
  });

  const defaultBundle: TypeBundle = {
    cpu: application?.bundle.resource.limitCPU || sortedBundles[0].spec.cpu.value,
    memory: application?.bundle.resource.limitMemory || sortedBundles[0].spec.memory.value,
    dedicatedDatabase: {
      cpu:
        application?.bundle.resource.dedicatedDatabase?.limitCPU ||
        sortedBundles[0].spec.dedicatedDatabaseCPU.value,
      memory:
        application?.bundle.resource.dedicatedDatabase?.limitMemory ||
        sortedBundles[0].spec.dedicatedDatabaseMemory.value,
      capacity:
        application?.bundle.resource.dedicatedDatabase?.capacity ||
        sortedBundles[0].spec.dedicatedDatabaseCapacity.value,
      replicas:
        application?.bundle.resource.dedicatedDatabase?.replicas ||
        sortedBundles[0].spec.dedicatedDatabaseReplicas.value,
    },
  };

  const defaultAutoscaling: TypeAutoscaling = {
    enable: application?.bundle.autoscaling?.enable || false,
    minReplicas: application?.bundle.autoscaling?.minReplicas || 1,
    maxReplicas: application?.bundle.autoscaling?.maxReplicas || 5,
    targetCPUUtilizationPercentage:
      application?.bundle.autoscaling?.targetCPUUtilizationPercentage || null,
    targetMemoryUtilizationPercentage:
      application?.bundle.autoscaling?.targetMemoryUtilizationPercentage || null,
  };

  const [bundle, setBundle] = useState(defaultBundle);
  const [autoscaling, setAutoscaling] = useState(defaultAutoscaling);

  const { data: billingResourceOptionsRes, isLoading } = useQuery(
    queryKeys.useBillingResourceOptionsQuery,
    async () => {
      return ResourceControllerGetResourceOptions({});
    },
    {
      enabled: isOpen,
    },
  );

  const updateAppMutation = useMutation((params: any) => ApplicationControllerUpdateName(params));
  const createAppMutation = useMutation((params: any) => ApplicationControllerCreate(params));
  const changeBundleMutation = useMutation((params: any) =>
    ApplicationControllerUpdateBundle(params),
  );

  const onSubmit = async (data: FormData) => {
    let res: any = {};

    switch (type) {
      case "edit":
        res = await updateAppMutation.mutateAsync({
          name: data.name,
          appid: application?.appid,
        });
        break;

      case "change":
        res = await changeBundleMutation.mutateAsync({
          ...bundle,
          appid: application?.appid,
          autoscaling,
        });

        if (isCurrentApp) {
          const newResource = {
            ...currentApp.bundle.resource,
            limitCPU: bundle.cpu,
            limitMemory: bundle.memory,
            dedicatedDatabase: {
              limitCPU: bundle.dedicatedDatabase?.cpu || 0,
              limitMemory: bundle.dedicatedDatabase?.memory || 0,
              capacity: bundle.dedicatedDatabase?.capacity || 0,
              replicas: bundle.dedicatedDatabase?.replicas || 0,
            },
          };

          const newBundle = {
            ...currentApp.bundle,
            resource: newResource,
            autoscaling: autoscaling,
          };
          setCurrentApp({ ...currentApp, bundle: newBundle });
        }

        if (
          currentApp &&
          (bundle.cpu !== application?.bundle.resource.limitCPU ||
            bundle.memory !== application?.bundle.resource.limitMemory)
        ) {
          updateCurrentApp(
            currentApp!,
            currentApp!.state === APP_STATUS.Stopped ? APP_STATUS.Running : APP_STATUS.Restarting,
          );
        }
        break;

      case "create":
        res = await createAppMutation.mutateAsync({
          ...data,
          ...bundle,
          autoscaling,
        });
        break;

      default:
        break;
    }

    if (!res.error) {
      onClose();
      if (type !== "create") {
        showSuccess(t("update success"));
      } else {
        showSuccess(t("create success"));
      }
      // Run every 2 seconds, 2 times in total
      queryClient.invalidateQueries(APP_LIST_QUERY_KEY);
      const interval = setInterval(() => {
        queryClient.invalidateQueries(APP_LIST_QUERY_KEY);
      }, 2000);
      setTimeout(() => {
        clearInterval(interval);
      }, 4000);
    }
  };

  return (
    <>
      {cloneElement(props.children, {
        onClick: (event?: any) => {
          event?.preventDefault();
          reset(defaultValues);
          setBundle(defaultBundle);
          setAutoscaling(defaultAutoscaling);
          onOpen();
          setTimeout(() => {
            setFocus("name");
          }, 0);
        },
      })}
      {isOpen && !isLoading ? (
        <Modal isOpen={isOpen} onClose={onClose}>
          <ModalOverlay />
          <ModalContent maxW={"80%"} width={"auto"} minW={"800px"} m={"auto"}>
            <ModalHeader>{title}</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <VStack spacing={0} align="flex-start" px="8" gap="6">
                <FormControl
                  isRequired
                  isInvalid={!!errors?.name}
                  isDisabled={type === "change"}
                  hidden={type === "change"}
                >
                  <div className="flex h-12 w-full items-center border-b-2">
                    <input
                      {...register("name", {
                        required: `${t("HomePanel.Application") + t("Name") + t("IsRequired")}`,
                      })}
                      id="name"
                      placeholder={String(t("HomePanel.Application") + t("Name"))}
                      className="h-8 w-10/12 border-l-2 border-primary-600 bg-transparent pl-4 text-2xl font-medium"
                      style={{ outline: "none", boxShadow: "none" }}
                    />
                  </div>
                  <FormErrorMessage>{errors?.name && errors?.name?.message}</FormErrorMessage>
                </FormControl>
                {type !== "edit" && (
                  <>
                    <BundleControl
                      bundle={bundle}
                      sortedBundles={sortedBundles}
                      type={type}
                      onBundleItemChange={(k: string, v?: number) => {
                        setBundle((prev) => {
                          const v1 = _.cloneDeep(_.set(prev, k, v));
                          return v1;
                        });
                      }}
                      resourceOptions={billingResourceOptionsRes?.data}
                    />
                    <DatabaseBundleControl
                      bundle={bundle}
                      originCapacity={application?.bundle.resource.dedicatedDatabase?.capacity}
                      originReplicas={application?.bundle.resource.dedicatedDatabase?.replicas}
                      onBundleItemChange={(k: string, v?: number) => {
                        setBundle((prev) => {
                          const v1 = _.cloneDeep(_.set(prev, k, v));
                          return v1;
                        });
                      }}
                      type={type}
                      defaultDedicatedDatabaseBundle={defaultBundle.dedicatedDatabase}
                      resourceOptions={billingResourceOptionsRes?.data}
                    ></DatabaseBundleControl>
                    <AutoscalingControl autoscaling={autoscaling} setAutoscaling={setAutoscaling} />
                  </>
                )}
              </VStack>
            </ModalBody>
            <ModalFooter h={20}>
              <HStack spacing={0} w="full" justify="flex-end" px="8">
                {type !== "edit" && (
                  <Button
                    isLoading={createAppMutation.isLoading}
                    type="submit"
                    onClick={handleSubmit(onSubmit)}
                  >
                    {type === "change" ? t("Confirm") : t("CreateNow")}
                  </Button>
                )}
                {type === "edit" && (
                  <Button
                    isLoading={updateAppMutation.isLoading}
                    type="submit"
                    onClick={handleSubmit(onSubmit)}
                  >
                    {t("Confirm")}
                  </Button>
                )}
              </HStack>
            </ModalFooter>
          </ModalContent>
        </Modal>
      ) : null}
    </>
  );
};

CreateAppModal.displayName = "CreateModal";

export default CreateAppModal;
