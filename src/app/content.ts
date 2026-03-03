export default window.onload = () => {
  const element = document.createElement('h1');

  element.style.color = 'red';
  element.style.position = 'fixed';
  element.style.top = '64px';
  element.style.right = '64px';

  element.style.height = '100px';

  element.textContent = 'Hello from the content script';

  document.body.appendChild(element);
};
