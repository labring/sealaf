import { useEffect, useState } from "react";
import { Center, Spinner } from "@chakra-ui/react";
import { useMutation } from "@tanstack/react-query";
import { SessionV1 } from "@zjy365/sealos-desktop-sdk/*";
import { createSealosApp, sealosApp } from "@zjy365/sealos-desktop-sdk/app";

import useSessionStore from "./store";

import { AuthenticationControllerSignin } from "@/apis/v1/auth";

const AuthPage = () => {
  const { session, setSession, getKubeconfig, getNamespace } = useSessionStore();
  const [isInit, setIsInit] = useState(false);

  useEffect(() => {
    return createSealosApp();
  }, []);

  useEffect(() => {
    const initApp = async () => {
      const sealosUser = import.meta.env.VITE_SEALOS_MOCK_USER;
      const sealosKc = import.meta.env.VITE_SEALOS_MOCK_KC;

      if (sealosUser && sealosKc) {
        const testSession: SessionV1 = {
          user: {
            id: "",
            name: sealosUser,
            avatar: "",
            k8sUsername: "",
            nsid: "",
          },
          kubeconfig: sealosKc,
        };
        setSession(testSession);
        return;
      }

      const result = await sealosApp.getSession();

      setSession(result);
    };

    initApp().finally(() => setIsInit(true));
  }, []);

  const { mutateAsync: signin } = useMutation(["signin"], () => {
    return AuthenticationControllerSignin({
      username: session.user.name,
      namespace: getNamespace(),
      kubeconfig: getKubeconfig(),
    });
  });

  useEffect(() => {
    if (!isInit) return;

    const localNamespace = localStorage.getItem("sealos-namespace");
    const localToken = localStorage.getItem("token");
    const namespace = getNamespace();

    if (session.user && namespace && (localNamespace !== namespace || !localToken)) {
      signin().then((res) => {
        localStorage.setItem("token", res?.data.token);
        localStorage.setItem("sealos-namespace", namespace);
        window.location.href = "/dashboard";
      });
    } else if (localToken && namespace && localNamespace === namespace) {
      window.location.href = "/dashboard";
    }
  }, [session, isInit]);

  return (
    <Center w="100vw" h="100vh">
      <Spinner></Spinner>
    </Center>
  );
};

export default AuthPage;
