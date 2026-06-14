document.addEventListener('DOMContentLoaded', () => {
  const modalBackdrop = document.getElementById('staticPageModal');
  if (!modalBackdrop) return;

  const closeIcon = modalBackdrop.querySelector('.close-btn');

  const closeModal = () => {
    modalBackdrop.style.display = 'none';
    modalBackdrop.hidden = true;
    document.body.style.overflow = '';
  };

  const openModal = () => {
    modalBackdrop.style.display = 'grid';
    modalBackdrop.hidden = false;
    document.body.style.overflow = 'hidden';
  };

  if (closeIcon) {
    closeIcon.addEventListener('click', closeModal);
  }

  modalBackdrop.addEventListener('click', event => {
    const clickedClose = event.target.closest('[data-modal-close]');
    if (clickedClose || event.target === modalBackdrop) {
      closeModal();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modalBackdrop.hidden) {
      closeModal();
    }
  });

  openModal();
});