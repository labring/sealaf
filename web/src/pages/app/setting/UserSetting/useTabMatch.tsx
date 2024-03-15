import { useTranslation } from "react-i18next";

import { PATIcon } from "@/components/CommonIcon";

import { TabKeys } from "@/pages/app/setting";
import PATList from "@/pages/app/setting/UserSetting/PATList";

export default function useTabMatch(type: string) {
  const { t } = useTranslation();

  const User_TabMatch = [
    {
      title: "",
      items: [
        {
          key: TabKeys.PAT,
          name: t("Personal Access Token"),
          component: <PATList />,
          icon: <PATIcon boxSize={4} />,
        },
      ],
    },
  ];

  if (type === "user") {
    return User_TabMatch;
  }
}
