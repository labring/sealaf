import { useQuery } from "@tanstack/react-query";

import { ResourceControllerGetResourceBundles } from "@/apis/v1/resources";

export const queryKeys = {
  useAccountQuery: ["useAccountQuery"],
  useBillingPriceQuery: ["useBillingPriceQuery"],
  useBillingResourceOptionsQuery: ["useBillingResourceOptionsQuery"],
  useResourceBundlesQuery: ["useBillingResourceBundlesQuery"],
};

export const useResourceBundlesQuery = () => {
  return useQuery(queryKeys.useResourceBundlesQuery, async () => {
    return ResourceControllerGetResourceBundles({});
  });
};
