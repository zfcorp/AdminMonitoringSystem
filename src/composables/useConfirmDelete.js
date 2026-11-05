import { useConfirm } from 'primevue/useconfirm'

/**
 * Reusable composable wrapping PrimeVue's ConfirmDialog for
 * delete confirmations. Provides a simple confirmDelete() function
 * shared by all module list views.
 *
 * @returns {{ confirmDelete: (opts: { message: string, header?: string, onAccept: () => void }) => void }}
 */
export function useConfirmDelete() {
  const confirm = useConfirm()

  function confirmDelete({ message, header = 'Confirm Delete', onAccept }) {
    confirm.require({
      message,
      header,
      icon: 'pi pi-exclamation-triangle',
      acceptClass: 'p-button-danger',
      accept: onAccept,
    })
  }

  return { confirmDelete }
}
