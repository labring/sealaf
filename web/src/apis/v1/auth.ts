// @ts-ignore
/* eslint-disable */
///////////////////////////////////////////////////////////////////////
//                                                                   //
// this file is autogenerated by service-generate                    //
// do not edit this file manually                                    //
//                                                                   //
///////////////////////////////////////////////////////////////////////
/// <reference path = "api-auto.d.ts" />
import request from '@/utils/request';
import useGlobalStore from "@/pages/globalStore";

/**
* Signin by kubeconfig
*/
export async function AuthenticationControllerSignin(
  params: Definitions.SigninDto,
): Promise<{
    error: string;
    data: Paths.AuthenticationControllerSignin.Responses
}> {
  // /v1/auth/signin
  let _params: { [key: string]: any } = {
    appid: useGlobalStore.getState().currentApp?.appid || '',
    ...params,
  };
  return request(`/v1/auth/signin`, {
    method: 'POST',
    data : params,
  });
}

/**
* Get user token by PAT
*/
export async function AuthenticationControllerPat2token(
  params: Definitions.Pat2TokenDto,
): Promise<{
    error: string;
    data: Paths.AuthenticationControllerPat2token.Responses
}> {
  // /v1/auth/pat2token
  let _params: { [key: string]: any } = {
    appid: useGlobalStore.getState().currentApp?.appid || '',
    ...params,
  };
  return request(`/v1/auth/pat2token`, {
    method: 'POST',
    data : params,
  });
}

