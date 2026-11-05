import { ref, computed } from 'vue'

/**
 * Reusable composable for paginated, sorted, filtered CRUD list views.
 * Encapsulates pagination, sorting, and lazy-loading logic shared by
 * the Transmittal, Borrowed, and Follow-up list views.
 *
 * @param {object} store - Pinia store instance with fetch(), totalCount, loading
 * @param {object} options
 * @param {string} options.itemsKey - property name on the store holding the array
 * @param {object} options.defaultSort - { field, order: 'asc'|'desc' }
 * @param {number} options.perPageDefault
 */
export function useCrudList(store, options = {}) {
  const {
    itemsKey = 'items',
    defaultSort = { field: 'created_at', order: 'desc' },
    perPageDefault = 20,
  } = options

  const perPage = ref(perPageDefault)
  const currentPage = ref(1)
  const sortField = ref(defaultSort.field)
  const sortOrder = ref(defaultSort.order)
  const lazyParams = ref({ first: 0, rows: perPageDefault })

  const items = computed(() => store[itemsKey] || [])
  const totalCount = computed(() => store.totalCount || 0)
  const loading = computed(() => store.loading || false)

  /**
   * Load data from the store with current pagination/sort state.
   * @param {object} filters - module-specific filter object
   */
  async function loadData(filters = {}) {
    await store.fetch({
      page: currentPage.value,
      perPage: perPage.value,
      sortBy: { field: sortField.value, order: sortOrder.value },
      filters,
    })
  }

  function onPage(event) {
    lazyParams.value = event
    currentPage.value = event.page + 1
    perPage.value = event.rows
  }

  function onSort(event) {
    lazyParams.value = event
    sortField.value = event.sortField
    sortOrder.value = event.sortOrder === 1 ? 'asc' : 'desc'
    currentPage.value = 1
  }

  return {
    perPage,
    currentPage,
    sortField,
    sortOrder,
    lazyParams,
    items,
    totalCount,
    loading,
    loadData,
    onPage,
    onSort,
  }
}
