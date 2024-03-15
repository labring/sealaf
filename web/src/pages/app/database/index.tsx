/****************************
 * cloud functions database page
 ***************************/
import { useRef } from "react";

import Content from "@/components/Content";
import { Col, Row } from "@/components/Grid";
import Panel from "@/components/Panel";
import Resize from "@/components/Resize";

import StatusBar from "../mods/StatusBar";

import CollectionDataList from "./CollectionDataList";
import CollectionListPanel from "./CollectionListPanel";

import useCustomSettingStore from "@/pages/customSetting";
function DatabasePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const settingStore = useCustomSettingStore();

  return (
    <Content>
      <Row className="flex-grow" ref={containerRef}>
        <Col style={{ width: settingStore.layoutInfo.collectionPage.SideBar.style.width }}>
          <CollectionListPanel />
        </Col>
        <Resize type="x" pageId="collectionPage" panelId="SideBar" containerRef={containerRef} />
        <Col>
          <Panel className="h-full items-stretch">
            <CollectionDataList />
          </Panel>
        </Col>
      </Row>
      <StatusBar />
    </Content>
  );
}

export default DatabasePage;
