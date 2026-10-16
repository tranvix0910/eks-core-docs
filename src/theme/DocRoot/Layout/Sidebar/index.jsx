import React from 'react';
import Sidebar from '@theme-original/DocRoot/Layout/Sidebar';
import SidebarResizer from '@site/src/components/SidebarResizer';

// Default sidebar container plus a drag handle on its right edge.
export default function SidebarWrapper(props) {
  return (
    <>
      <Sidebar {...props} />
      {!props.hiddenSidebarContainer && <SidebarResizer />}
    </>
  );
}
