import { lazy, Suspense } from "react";
import { useRoutes } from "react-router-dom";
import { wrapUseRoutes } from "@sentry/react";

import BasicLayout from "@/layouts/Basic";
import FunctionLayout from "@/layouts/Function";
import TemplateLayout from "@/layouts/Template";

const route404 = {
  path: "*",
  element: () => import("@/pages/404"),
};

const routes = [
  {
    path: "/",
    children: [
      {
        path: "/",
        element: () => import("@/pages/auth"),
        index: true,
      },
      {
        path: "/dashboard",
        element: <BasicLayout />,
        auth: true,
        children: [
          {
            path: "/dashboard",
            element: () => import("@/pages/home/index"),
          },
        ],
      },
      {
        path: "/app",
        element: <FunctionLayout />,
        auth: true,
        children: [
          {
            path: "/app/:appid/:pageId/:id?/*",
            element: () => import("@/pages/app/index"),
          },
        ],
      },
      {
        path: "/market/templates",
        element: <TemplateLayout />,
        auth: true,
        children: [
          {
            path: "/market/templates/:templateId?",
            element: () => import("@/pages/functionTemplate"),
          },
        ],
      },
      {
        path: "/market/templates/:templateId/edit",
        element: <TemplateLayout />,
        auth: true,
        children: [
          {
            path: "/market/templates/:templateId/edit",
            element: () => import("@/pages/functionTemplate/CreateFuncTemplate"),
          },
        ],
      },
      {
        path: "/market/templates/create",
        element: <TemplateLayout />,
        auth: true,
        children: [
          {
            path: "/market/templates/create",
            element: () => import("@/pages/functionTemplate/CreateFuncTemplate"),
          },
        ],
      },
      {
        path: "/403",
        element: () => import("@/pages/403"),
      },
      route404,
    ],
  },
];

function LazyElement(props: any) {
  const { importFunc } = props;
  const LazyComponent = lazy(importFunc);
  return (
    <Suspense fallback={null}>
      <LazyComponent />
    </Suspense>
  );
}

function dealRoutes(routesArr: any) {
  if (routesArr && Array.isArray(routesArr) && routesArr.length > 0) {
    routesArr.forEach((route) => {
      if (route.element && typeof route.element == "function") {
        const importFunc = route.element;
        route.element = <LazyElement importFunc={importFunc} />;
      }
      if (route.children) {
        dealRoutes(route.children);
      }
    });
  }
}

function RouteElement() {
  const useSentryRoutes = wrapUseRoutes(useRoutes);

  dealRoutes(routes);
  const element = useSentryRoutes(routes as any);
  return element;
}

export default RouteElement;
