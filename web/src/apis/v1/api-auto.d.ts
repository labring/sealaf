declare namespace Definitions {

     export type CreateFunctionDto = {
name?: string; /* Function name is unique in the application */
description?: string; methods?: string[]; code?: string; /* The source code of the function */
tags?: string[]; }

     export type CloudFunction = {
_id?: string; appid?: string; name?: string; source?: Definitions.CloudFunctionSource; desc?: string; tags?: string[]; methods?: string[]; params?: {}; createdAt?: string; updatedAt?: string; createdBy?: string; }

     export type UpdateFunctionDto = {
newName?: string; /* Function name is unique in the application */
description?: string; methods?: string[]; code?: string; /* The source code of the function */
tags?: string[]; changelog?: string; }

     export type UpdateFunctionDebugDto = {
params?: {}; }

     export type CompileFunctionDto = {
code?: string; /* The source code of the function */
}

     export type CreateApplicationDto = {
cpu?: number; memory?: number; autoscaling?: Definitions.CreateAutoscalingDto; dedicatedDatabase?: Definitions.CreateDedicatedDatabaseDto; name?: string; state?: string; regionId?: string; runtimeId?: string; }

     export type ApplicationWithRelations = {
_id?: string; name?: string; appid?: string; regionId?: string; runtimeId?: string; tags?: string[]; state?: string; phase?: string; createdAt?: string; updatedAt?: string; createdBy?: string; region?: Definitions.Region; user?: Definitions.User; bundle?: Definitions.ApplicationBundle; runtime?: Definitions.Runtime; configuration?: Definitions.ApplicationConfiguration; domain?: Definitions.RuntimeDomain; }

     export type Application = {
_id?: string; name?: string; appid?: string; regionId?: string; runtimeId?: string; tags?: string[]; state?: string; phase?: string; createdAt?: string; updatedAt?: string; createdBy?: string; }

     export type UpdateApplicationNameDto = {
name?: string; }

     export type UpdateApplicationStateDto = {
state?: string; }

     export type UpdateApplicationBundleDto = {
cpu?: number; memory?: number; autoscaling?: Definitions.CreateAutoscalingDto; dedicatedDatabase?: Definitions.CreateDedicatedDatabaseDto; }

     export type ApplicationBundle = {
_id?: string; appid?: string; resource?: Definitions.ApplicationBundleResource; autoscaling?: Definitions.Autoscaling; isTrialTier?: boolean; createdAt?: string; updatedAt?: string; }

     export type BindCustomDomainDto = {
domain?: string; }

     export type RuntimeDomain = {
_id?: string; appid?: string; domain?: string; customDomain?: string; state?: string; phase?: string; createdAt?: string; updatedAt?: string; }

     export type CreateEnvironmentDto = {
name?: string; value?: string; }

     export type PodNameListDto = {
appid?: string; podNameList?: string[]; /* List of pod identifiers */
}

     export type ContainerNameListDto = {
podName?: string; containerNameList?: string[]; /* List of container identifiers */
}

     export type CreateCollectionDto = {
name?: string; }

     export type Collection = {
name?: string; type?: string; options?: {}; info?: {}; idIndex?: {}; }

     export type UpdateCollectionDto = {
validatorSchema?: {}; validationLevel?: string; }

     export type SigninDto = {
kubeconfig?: string; username?: string; namespace?: string; }

     export type Pat2TokenDto = {
pat?: string; /* PAT */
}

     export type CreatePATDto = {
name?: string; expiresIn?: number; }

     export type User = {
_id?: string; username?: string; namespace?: string; kubeconfig?: string; createdAt?: string; updatedAt?: string; }

     export type DeleteDependencyDto = {
name?: string; }

     export type CreateTriggerDto = {
desc?: string; cron?: string; target?: string; }

     export type CalculatePriceDto = {
cpu?: number; memory?: number; autoscaling?: Definitions.CreateAutoscalingDto; dedicatedDatabase?: Definitions.CreateDedicatedDatabaseDto; regionId?: string; }

     export type CalculatePriceResultDto = {
cpu?: number; memory?: number; total?: number; }

     export type CreateFunctionTemplateDto = {
name?: string; /* function template name */
dependencies?: Definitions.CreateDependencyDto[]; /* Dependencies */
environments?: Definitions.CreateEnvironmentDto[]; /* environments */
private?: boolean; /* Private flag */
description?: string; /* function template description */
items?: Definitions.FunctionTemplateItemDto[]; /* items of the function template */
}

     export type UpdateFunctionTemplateDto = {
functionTemplateId?: any; /* Function template id */
name?: string; /* Template name */
dependencies?: Definitions.CreateDependencyDto[]; /* Dependencies */
environments?: Definitions.CreateEnvironmentDto[]; /* Environments */
private?: boolean; /* Private flag */
description?: string; /* function template description */
items?: Definitions.FunctionTemplateItemDto[]; /* items of the function template */
}

     export type DeleteRecycleBinItemsDto = {
ids?: string[]; /* The list of item ids */
}

     export type Number = {
}

     export type RestoreRecycleBinItemsDto = {
ids?: string[]; /* The list of item ids */
}

     export type CloudFunctionSource = {
code?: string; compiled?: string; uri?: string; version?: number; hash?: string; lang?: string; }

     export type CreateAutoscalingDto = {
enable?: boolean; minReplicas?: number; maxReplicas?: number; targetCPUUtilizationPercentage?: number; targetMemoryUtilizationPercentage?: number; }

     export type CreateDedicatedDatabaseDto = {
cpu?: number; memory?: number; capacity?: number; replicas?: number; }

     export type Region = {
_id?: string; name?: string; displayName?: string; state?: string; createdAt?: string; updatedAt?: string; }

     export type ApplicationBundleResource = {
limitCPU?: number; limitMemory?: number; limitCountOfCloudFunction?: number; limitCountOfBucket?: number; limitCountOfDatabasePolicy?: number; limitCountOfTrigger?: number; limitCountOfWebsiteHosting?: number; reservedTimeAfterExpired?: number; dedicatedDatabase?: Definitions.DedicatedDatabaseSpec; }

     export type DedicatedDatabaseSpec = {
limitCPU?: number; limitMemory?: number; capacity?: number; replicas?: number; }

     export type Autoscaling = {
enable?: boolean; minReplicas?: number; maxReplicas?: number; targetCPUUtilizationPercentage?: number; targetMemoryUtilizationPercentage?: number; }

     export type Runtime = {
_id?: string; name?: string; type?: string; image?: Definitions.RuntimeImageGroup; state?: string; version?: string; latest?: boolean; }

     export type RuntimeImageGroup = {
main?: string; init?: string; sidecar?: string; }

     export type ApplicationConfiguration = {
_id?: string; appid?: string; environments?: Definitions.EnvironmentVariable[]; dependencies?: string[]; createdAt?: string; updatedAt?: string; }

     export type EnvironmentVariable = {
name?: string; value?: string; }

     export type CreateDependencyDto = {
name?: string; spec?: string; }

     export type FunctionTemplateItemDto = {
name?: string; /* FunctionTemplate item name */
description?: string; methods?: string[]; code?: string; /* The source code of the function */
}

}

declare namespace Paths {

    namespace AppControllerGetRuntimes {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace FunctionControllerCreate {
      export type QueryParameters = any;

      export type BodyParameters = Definitions.CreateFunctionDto;

      export type Responses = any;
    }

    namespace FunctionControllerFindAll {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace FunctionControllerFindOne {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace FunctionControllerUpdate {
      export type QueryParameters = any;

      export type BodyParameters = Definitions.UpdateFunctionDto;

      export type Responses = any;
    }

    namespace FunctionControllerRemove {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace FunctionControllerUpdateDebug {
      export type QueryParameters = any;

      export type BodyParameters = Definitions.UpdateFunctionDebugDto;

      export type Responses = any;
    }

    namespace FunctionControllerCompile {
      export type QueryParameters = any;

      export type BodyParameters = Definitions.CompileFunctionDto;

      export type Responses = any;
    }

    namespace FunctionControllerGetHistory {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace ApplicationControllerCreate {
      export type QueryParameters = any;

      export type BodyParameters = Definitions.CreateApplicationDto;

      export type Responses = any;
    }

    namespace ApplicationControllerFindAll {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace ApplicationControllerFindOne {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace ApplicationControllerDelete {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace ApplicationControllerUpdateName {
      export type QueryParameters = any;

      export type BodyParameters = Definitions.UpdateApplicationNameDto;

      export type Responses = any;
    }

    namespace ApplicationControllerUpdateState {
      export type QueryParameters = any;

      export type BodyParameters = Definitions.UpdateApplicationStateDto;

      export type Responses = any;
    }

    namespace ApplicationControllerUpdateBundle {
      export type QueryParameters = any;

      export type BodyParameters = Definitions.UpdateApplicationBundleDto;

      export type Responses = any;
    }

    namespace ApplicationControllerBindDomain {
      export type QueryParameters = any;

      export type BodyParameters = Definitions.BindCustomDomainDto;

      export type Responses = any;
    }

    namespace ApplicationControllerRemove {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace ApplicationControllerCheckResolved {
      export type QueryParameters = any;

      export type BodyParameters = Definitions.BindCustomDomainDto;

      export type Responses = any;
    }

    namespace EnvironmentVariableControllerUpdateAll {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace EnvironmentVariableControllerAdd {
      export type QueryParameters = any;

      export type BodyParameters = Definitions.CreateEnvironmentDto;

      export type Responses = any;
    }

    namespace EnvironmentVariableControllerGet {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace EnvironmentVariableControllerDelete {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace PodControllerGetPodNameList {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace PodControllerGetContainerNameList {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace CollectionControllerCreate {
      export type QueryParameters = any;

      export type BodyParameters = Definitions.CreateCollectionDto;

      export type Responses = any;
    }

    namespace CollectionControllerFindAll {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace CollectionControllerFindOne {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace CollectionControllerUpdate {
      export type QueryParameters = any;

      export type BodyParameters = Definitions.UpdateCollectionDto;

      export type Responses = any;
    }

    namespace CollectionControllerRemove {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace DatabaseControllerProxy {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace DedicatedDatabaseMonitorControllerGetResource {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace DedicatedDatabaseMonitorControllerGetConnection {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace DedicatedDatabaseMonitorControllerGetPerformance {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace AuthenticationControllerSignin {
      export type QueryParameters = any;

      export type BodyParameters = Definitions.SigninDto;

      export type Responses = any;
    }

    namespace AuthenticationControllerPat2token {
      export type QueryParameters = any;

      export type BodyParameters = Definitions.Pat2TokenDto;

      export type Responses = any;
    }

    namespace PatControllerCreate {
      export type QueryParameters = any;

      export type BodyParameters = Definitions.CreatePATDto;

      export type Responses = any;
    }

    namespace PatControllerFindAll {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace PatControllerRemove {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace UserControllerGetProfile {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace LogControllerStreamLogs {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace DependencyControllerAdd {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace DependencyControllerUpdate {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace DependencyControllerGetDependencies {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace DependencyControllerRemove {
      export type QueryParameters = any;

      export type BodyParameters = Definitions.DeleteDependencyDto;

      export type Responses = any;
    }

    namespace TriggerControllerCreate {
      export type QueryParameters = any;

      export type BodyParameters = Definitions.CreateTriggerDto;

      export type Responses = any;
    }

    namespace TriggerControllerFindAll {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace TriggerControllerRemove {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace RegionControllerGetRegions {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace SettingControllerGetSettings {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace SettingControllerGetSettingByKey {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace ResourceControllerCalculatePrice {
      export type QueryParameters = any;

      export type BodyParameters = Definitions.CalculatePriceDto;

      export type Responses = any;
    }

    namespace ResourceControllerGetResourceOptions {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace ResourceControllerGetResourceOptionsByRegionId {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace ResourceControllerGetResourceBundles {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace FunctionTemplateControllerCreateFunctionTemplate {
      export type QueryParameters = any;

      export type BodyParameters = Definitions.CreateFunctionTemplateDto;

      export type Responses = any;
    }

    namespace FunctionTemplateControllerGetAllFunctionTemplate {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace FunctionTemplateControllerUseFunctionTemplate {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace FunctionTemplateControllerUpdateFunctionTemplate {
      export type QueryParameters = any;

      export type BodyParameters = Definitions.UpdateFunctionTemplateDto;

      export type Responses = any;
    }

    namespace FunctionTemplateControllerDeleteFunctionTemplate {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace FunctionTemplateControllerGetOneFunctionTemplate {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace FunctionTemplateControllerStarFunctionTemplate {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace FunctionTemplateControllerGetUserFunctionTemplateStarState {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace FunctionTemplateControllerGetFunctionTemplateUsedBy {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace FunctionTemplateControllerGetMyFunctionTemplate {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace FunctionTemplateControllerGetRecommendFunctionTemplate {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace FunctionRecycleBinControllerDeleteRecycleBinItems {
      export type QueryParameters = any;

      export type BodyParameters = Definitions.DeleteRecycleBinItemsDto;

      export type Responses = any;
    }

    namespace FunctionRecycleBinControllerEmptyRecycleBin {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace FunctionRecycleBinControllerGetRecycleBin {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }

    namespace FunctionRecycleBinControllerRestoreRecycleBinItems {
      export type QueryParameters = any;

      export type BodyParameters = Definitions.RestoreRecycleBinItemsDto;

      export type Responses = any;
    }

    namespace MonitorControllerGetData {
      export type QueryParameters = any;

      export type BodyParameters = any;

      export type Responses = any;
    }


}