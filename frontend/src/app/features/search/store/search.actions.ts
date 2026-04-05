import { createActionGroup, props } from '@ngrx/store';

import { SearchResponse, SearchSuggestion } from '../../../shared/models/search.models';
import { TelemetryBatchRequest } from '../../../shared/models/telemetry.models';

export const SearchActions = createActionGroup({
  source: 'Search',
  events: {
    'Suggestions Requested': props<{ query: string }>(),
    'Suggestions Loaded': props<{ suggestions: readonly SearchSuggestion[] }>(),
    'Search Requested': props<{ query: string; page: number }>(),
    'Search Loaded': props<{ response: SearchResponse }>(),
    'Telemetry Flush Requested': props<{ payload: TelemetryBatchRequest }>(),
    'Failure Received': props<{ message: string }>(),
  },
});
