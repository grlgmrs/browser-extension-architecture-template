const MenuItemId = {
  PageClick: 'page-click',
  SelectionClick: 'selection-click',
} as const;

const handleOnPageClick = (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => {
  console.log('On page click', info, tab);
};

const handleOnSelectionClick = (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => {
  console.log('On page click', info, tab);
};

const onClickFn: Record<string, (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => void> = {
  [MenuItemId.PageClick]: handleOnPageClick,
  [MenuItemId.SelectionClick]: handleOnSelectionClick,
};

export default chrome.runtime.onInstalled.addListener(() => {
  console.log('Chrome extension template - React app installed');

  chrome.contextMenus.create({ id: MenuItemId.PageClick, title: 'Page click', contexts: ['page'] });
  chrome.contextMenus.create({ id: MenuItemId.SelectionClick, title: 'Selection click', contexts: ['selection'] });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    const { menuItemId } = info;

    if (onClickFn[menuItemId]) onClickFn[menuItemId](info, tab);
  });
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'open_side_panel') {
    chrome.windows.getCurrent((window) => {
      if (!window?.id) {
        console.error('No window id found');
        return;
      }

      chrome.sidePanel.open({ windowId: window.id });
    });
  }
});
