/**
 * Search module — re-exports all search sub-modules.
 */
export { search, rebuildSearchIndex } from "./fts";
export { filteredSearch, type SearchFilters, type FilteredSearchResult } from "./filters";
export { trackSearch, trackSearchClick, getPopularSearches, getZeroResultSearches, getSearchStats, type SearchAnalyticsEvent } from "./analytics";
export { getSuggestions, type SearchSuggestion } from "./suggestions";
export { getUserSavedSearches, createSavedSearch, deleteSavedSearch, type SavedSearch } from "./saved";
export { getRrfK, recordSearchFeedback, getSearchQualityStats } from "./quality";
