import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Center, Spinner } from "@chakra-ui/react";
import { useMutation } from "@tanstack/react-query";

import useSessionStore from "./store";

import { AuthenticationControllerSignin } from "@/apis/v1/auth";

const AuthPage = () => {
  const navigate = useNavigate();
  const { session, getKubeconfig, getNamespace } = useSessionStore();

  const { mutateAsync: signin } = useMutation(["signin"], () => {
    return AuthenticationControllerSignin({
      username: session.user.name,
      namespace: getNamespace(),
      kubeconfig: getKubeconfig(),
    });
  });

  const handleAuth = async () => {
    const localNamespace = localStorage.getItem("sealos-namespace");
    const localToken = localStorage.getItem("token");
    const namespace = getNamespace();

    if (session.user && namespace && (localNamespace !== namespace || !localToken)) {
      try {
        const res = await signin();
        localStorage.setItem("token", res?.data.token);
        localStorage.setItem("sealos-namespace", namespace);
        navigate("/dashboard");
      } catch (error) {
        if (error instanceof Error) {
          // eslint-disable-next-line no-console
          console.error("login error:", error.message);
        } else {
          // eslint-disable-next-line no-console
          console.error("login error:", error);
        }
      }
    } else if (localToken && namespace && localNamespace === namespace) {
      navigate("/dashboard");
    }
  };

  // after signin, handle auth and goto dashboard
  useEffect(() => {
    handleAuth();
  }, [session]);

  return (
    <Center w="100vw" h="100vh">
      <Spinner></Spinner>
    </Center>
  );
};

export default AuthPage;
