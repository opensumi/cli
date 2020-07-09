import * as React from "react";
import { useState, useEffect } from 'react';
import { Button } from 'kaitian-browser';

import { INodeService } from "../common/service";
import './style.less';

const defaultTitle = "左侧面板";

export const Leftview: React.FC<IComponentProps<INodeService>> = ({
  kaitianExtendSet,
  kaitianExtendService,
}) => {
  const [title, setTitle] = useState(defaultTitle);

  function onDidUpdateTitle(val: string) {
    setTitle(defaultTitle + " " + val);
  }

  useEffect(() => {
    if (kaitianExtendSet) {
      kaitianExtendSet.set({
        updateTitle: onDidUpdateTitle,
      });
    }
  }, []);

  function clickHandler() {
    kaitianExtendService.node.sayHello().then(msg => {
      console.log("Leftview receive message", msg);
    });
  }

  return (
    <div className="kt-extension-example-container">
      <p>{title}</p>
      <Button onClick={clickHandler}>change title</Button>
    </div>
  );
};
