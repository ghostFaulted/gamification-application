/** jsdom may lack or stub HTMLDialogElement.showModal/close; tests need the open attribute. */
export function polyfillDialog(): void {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
  };
}
