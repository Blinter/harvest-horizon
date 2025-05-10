/**
 * @file src/components/character/StatusLogMenu.jsx
 * @description React component to display recent status logs for a character.
 *
 * @module components/character/StatusLogMenu
 */
import { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  ListGroup,
  ListGroupItem,
  Spinner,
  Alert,
  Button,
  Input,
  Form,
  FormGroup,
  Label,
  Row,
  Col,
} from 'reactstrap';
import { getCharacterStatusLogs } from '../../api/statusLogApi';

// Possible status types based on the schema
const STATUS_TYPES = [
  'connected',
  'disconnected',
  'announcement',
  'achievement',
  'milestone',
  'event',
  'purchase',
  'sale',
];

/**
 * Formats a timestamp string into a more readable format.
 *
 * @param {string|Date} timestamp - The timestamp to format. Can be a Date
 *   object or an ISO string.
 * @returns {string} Formatted timestamp string (e.g., locale default like
 *   MM/DD/YYYY, HH:MM:SS AM/PM) or 'Invalid Date' if the input is invalid.
 */
const formatTimestamp = (timestamp) => {
  try {
    const date = new Date(timestamp);
    // Check if the date is valid before formatting
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return date.toLocaleString(); // Adjust format as needed
  } catch (e) {
    console.error('[StatusLogMenu] Error formatting timestamp:', e);
    return 'Invalid Date';
  }
};

/**
 * Filters logs based on a case-insensitive search term.
 *
 * The search checks the `details` and `statusType` fields of each log entry.
 *
 * @param {Array<object>} logs - The array of log objects to filter.
 * @param {string} searchTerm - The term to search for. If empty or null,
 *   all logs are returned.
 * @returns {Array<object>} A new array containing only the logs that match the
 *   search term.
 */
const filterBySearchTerm = (logs, searchTerm) => {
  if (!searchTerm) return logs;
  const lowerSearchTerm = searchTerm.toLowerCase();
  return logs.filter((log) => {
    const detailsMatch = (log.details?.toLowerCase() || '').includes(
      lowerSearchTerm
    );
    const typeMatch = log.statusType.toLowerCase().includes(lowerSearchTerm);
    return detailsMatch || typeMatch;
  });
};

/**
 * Filters logs by a specific status type.
 *
 * @param {Array<object>} logs - The array of log objects to filter.
 * @param {string} filterType - The `statusType` to filter by. If empty or
 *   null, all logs are returned.
 * @returns {Array<object>} A new array containing only the logs that match the
 *   specified status type.
 */
const filterByStatusType = (logs, filterType) => {
  if (!filterType) return logs;
  return logs.filter((log) => log.statusType === filterType);
};

/**
 * Filters logs based on a specified date range.
 *
 * Logs are included if their timestamp falls on or after the start date and
 * on or before the end date.
 *
 * @param {Array<object>} logs - The array of log objects to filter.
 * @param {string} startDateStr - The start date string in a format parseable
 *   by `new Date()` (e.g., 'YYYY-MM-DDTHH:mm'). If empty or invalid, the
 *   filter starts from the beginning of time.
 * @param {string} endDateStr - The end date string in a format parseable by
 *   `new Date()`. If empty or invalid, the filter extends to the maximum
 *   possible date.
 * @returns {Array<object>} A new array containing logs within the date range.
 */
const filterByDateRange = (logs, startDateStr, endDateStr) => {
  const start = startDateStr ? new Date(startDateStr).getTime() : 0;
  const end = endDateStr ? new Date(endDateStr).getTime() : Number.MAX_SAFE_INTEGER;

  // Avoid filtering if range is effectively unbounded
  if (start === 0 && end === Number.MAX_SAFE_INTEGER) {
    return logs;
  }

  return logs.filter((log) => {
    const logTime = new Date(log.timestamp).getTime();
    return !isNaN(logTime) && logTime >= start && logTime <= end;
  });
};

/**
 * Sorts an array of log objects, primarily by their timestamp.
 *
 * Currently, only sorting by 'timestamp' is implemented. Invalid dates are
 * pushed to the end of the sorted array.
 *
 * @param {Array<object>} logs - The array of log objects to sort.
 * @param {string} sortBy - The field to sort by. Currently accepts
 *   'timestamp'. Other values result in the original array being returned.
 * @param {string} sortOrder - The order to sort ('asc' for ascending/oldest
 *   first, 'desc' for descending/newest first).
 * @returns {Array<object>} A new array containing the sorted logs.
 */
const sortLogs = (logs, sortBy, sortOrder) => {
  if (sortBy === 'timestamp') {
    return [...logs].sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      if (isNaN(timeA)) return 1; // Push invalid dates to the end
      if (isNaN(timeB)) return -1;

      const comparison = timeA - timeB;
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }
  // Add other sort criteria handling here if needed in the future
  return logs; // Return original if sortBy is not recognized
};

/**
 * Renders the filter controls for the status log list.
 *
 * Allows users to filter logs by search term, status type, and date range,
 * and to control sorting and visibility of the filter section.
 *
 * @component LogFilters
 * @param {object} props - Component props.
 * @param {string} props.searchTerm - Current search term input value.
 * @param {Function} props.setSearchTerm - Callback to update the search term
 *   state.
 * @param {string} props.filterType - Current selected status type filter
 *   value.
 * @param {Function} props.setFilterType - Callback to update the status type
 *   filter state.
 * @param {string} props.filterStartDate - Current start date input value
 *   (YYYY-MM-DDTHH:mm).
 * @param {Function} props.setFilterStartDate - Callback to update the start
 *   date state.
 * @param {string} props.filterEndDate - Current end date input value
 *   (YYYY-MM-DDTHH:mm).
 * @param {Function} props.setFilterEndDate - Callback to update the end date
 *   state.
 * @param {boolean} props.applyDateFilter - Flag indicating if the date range
 *   filter is currently active.
 * @param {Function} props.setApplyDateFilter - Callback to update the active
 *   status of the date filter.
 * @param {Function} props.handleDateFilterApply - Callback triggered to apply
 *   the date range filter.
 * @param {Function} props.handleDateFilterClear - Callback triggered to clear
 *   the date range filter.
 * @param {string} props.sortOrder - Current sort order ('asc' or 'desc').
 * @param {Function} props.toggleSortOrder - Callback to toggle the sort
 *   order state between 'asc' and 'desc'.
 * @param {Function} props.handleResetFilters - Callback to reset all filter
 *   and sort states to their defaults.
 * @param {boolean} props.showFilters - Flag indicating if the filter controls
 *   section is visible.
 * @param {Function} props.setShowFilters - Callback to toggle the visibility
 *   of the filter controls.
 * @returns {React.ReactElement} The LogFilters component UI.
 */
const LogFilters = ({
  searchTerm,
  setSearchTerm,
  filterType,
  setFilterType,
  filterStartDate,
  setFilterStartDate,
  filterEndDate,
  setFilterEndDate,
  applyDateFilter,
  setApplyDateFilter, // Needed to reset applyDateFilter on date input change
  handleDateFilterApply,
  handleDateFilterClear,
  sortOrder,
  toggleSortOrder,
  handleResetFilters,
  showFilters,
  setShowFilters,
}) => {
  const areFiltersActive = searchTerm.length > 0 || filterType !== '' || applyDateFilter;
  const isSortingDefault = sortOrder === 'desc';
  const showActiveIndicator = areFiltersActive || !isSortingDefault;

  const handleFormSubmit = (e) => {
    e.preventDefault(); // Prevent default form submission (page reload)
  };

  if (!showFilters) {
    return (
      <Button
        color={showActiveIndicator ? 'warning' : 'secondary'}
        size="sm"
        onClick={() => setShowFilters(true)}
        className="mb-3"
        title="Show Filters"
      >
        Filters {showActiveIndicator ? '(!)' : ''}
      </Button>
    );
  }

  return (
    <Form
      className="mb-3 border p-2 rounded bg-white"
      onSubmit={handleFormSubmit}
    >
      <Row form="true">
        <Col md={6}>
          <FormGroup>
            <Label for="logSearch" hidden>
              Search
            </Label>
            <Input
              type="search"
              name="search"
              id="logSearch"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              bsSize="sm"
            />
          </FormGroup>
        </Col>
        <Col md={6}>
          <FormGroup>
            <Label for="logTypeFilter" hidden>
              Filter by Type
            </Label>
            <Input
              type="select"
              name="selectType"
              id="logTypeFilter"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              bsSize="sm"
              title="Filter by Status Type"
            >
              <option value="">All Types</option>
              {STATUS_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </Input>
          </FormGroup>
        </Col>
      </Row>
      <Row form="true" className="align-items-end">
        <Col md={4}>
          <FormGroup>
            <Label for="startDate">Start Date/Time</Label>
            <Input
              type="datetime-local"
              name="startDate"
              id="startDate"
              value={filterStartDate}
              onChange={(e) => {
                setFilterStartDate(e.target.value);
                setApplyDateFilter(false); // Reset active filter on change
              }}
              bsSize="sm"
              title="Start Date/Time for filtering"
            />
          </FormGroup>
        </Col>
        <Col md={4}>
          <FormGroup>
            <Label for="endDate">End Date/Time</Label>
            <Input
              type="datetime-local"
              name="endDate"
              id="endDate"
              value={filterEndDate}
              onChange={(e) => {
                setFilterEndDate(e.target.value);
                setApplyDateFilter(false); // Reset active filter on change
              }}
              bsSize="sm"
              title="End Date/Time for filtering"
            />
          </FormGroup>
        </Col>
        <Col md={4} className="d-flex mb-3" style={{ gap: '5px' }}>
          <Button
            color="primary"
            size="sm"
            onClick={handleDateFilterApply}
            disabled={!filterStartDate && !filterEndDate}
            title="Apply Date Range Filter"
          >
            Filter Dates
          </Button>
          <Button
            color="secondary"
            size="sm"
            onClick={handleDateFilterClear}
            disabled={!applyDateFilter}
            title="Clear Date Range Filter"
          >
            Clear
          </Button>
        </Col>
      </Row>
      <Row>
        <Col className="d-flex justify-content-end">
          <Button
            color="info"
            size="sm"
            onClick={toggleSortOrder}
            title={
              sortOrder === 'asc'
                ? 'Sort by Timestamp (Oldest First)'
                : 'Sort by Timestamp (Newest First)'
            }
          >
            Sort {sortOrder === 'asc' ? '▲' : '▼'}
          </Button>
        </Col>
        <Col className="d-flex justify-content-start" style={{ gap: '5px' }}>
          <Button
            color={showActiveIndicator ? 'warning' : 'secondary'}
            size="sm"
            onClick={() => setShowFilters(false)}
            title="Hide Filters"
          >
            Hide Filters
          </Button>
          <Button
            color={areFiltersActive ? 'danger' : 'warning'}
            size="sm"
            onClick={handleResetFilters}
            title="Reset all filters and sorting"
          >
            Reset {areFiltersActive ? '(!)' : ''}
          </Button>
        </Col>
      </Row>
    </Form>
  );
};

LogFilters.propTypes = {
  searchTerm: PropTypes.string.isRequired,
  setSearchTerm: PropTypes.func.isRequired,
  filterType: PropTypes.string.isRequired,
  setFilterType: PropTypes.func.isRequired,
  filterStartDate: PropTypes.string.isRequired,
  setFilterStartDate: PropTypes.func.isRequired,
  filterEndDate: PropTypes.string.isRequired,
  setFilterEndDate: PropTypes.func.isRequired,
  applyDateFilter: PropTypes.bool.isRequired,
  setApplyDateFilter: PropTypes.func.isRequired,
  handleDateFilterApply: PropTypes.func.isRequired,
  handleDateFilterClear: PropTypes.func.isRequired,
  sortOrder: PropTypes.oneOf(['asc', 'desc']).isRequired,
  toggleSortOrder: PropTypes.func.isRequired,
  handleResetFilters: PropTypes.func.isRequired,
  showFilters: PropTypes.bool.isRequired,
  setShowFilters: PropTypes.func.isRequired,
};

/**
 * Displays a list of recent status log entries for a given character.
 *
 * Fetches log data using the `getCharacterStatusLogs` API call upon mounting
 * or when the `characterId` prop changes. Provides filtering and sorting
 * capabilities for the displayed logs via the `LogFilters` component.
 *
 * @component StatusLogMenu
 * @param {object} props - Component props.
 * @param {string} props.characterId - The unique MongoDB ObjectId of the
 *   character whose status logs should be fetched and displayed.
 * @param {Function} props.onClose - Callback function invoked when the user
 *   clicks the close button on the menu.
 * @returns {React.ReactElement} The StatusLogMenu component UI, showing
 *   filters, loading/error states, and the list of logs.
 */
const StatusLogMenu = ({ characterId, onClose }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for filtering and sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState(''); // Default: show all types
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [applyDateFilter, setApplyDateFilter] = useState(false);
  // Trigger for date filtering
  const [sortBy, setSortBy] = useState('timestamp');
  // Default sort key
  const [sortOrder, setSortOrder] = useState('desc');
  // Default sort order (newest first)
  const [showFilters, setShowFilters] = useState(false);
  // State to toggle filter visibility

  useEffect(() => {
    /**
     * Fetches status logs for the current characterId.
     */
    const fetchLogs = async () => {
      if (!characterId) {
        setLoading(false);
        setError('No character selected.');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const fetchedLogs = await getCharacterStatusLogs(characterId);
        setLogs(fetchedLogs);
      } catch (err) {
        console.error(`[StatusLogMenu] Error fetching logs:`, err);
        setError(
          err.response?.data?.error ||
          err.message ||
          'Failed to load status logs.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [characterId]); // Re-fetch if characterId changes

  // Memoized calculation for filtered and sorted logs
  const filteredSortedLogs = useMemo(() => {
    let processedLogs = [...logs];

    // Apply filters sequentially
    processedLogs = filterBySearchTerm(processedLogs, searchTerm);
    processedLogs = filterByStatusType(processedLogs, filterType);
    if (applyDateFilter) {
      processedLogs = filterByDateRange(
        processedLogs,
        filterStartDate,
        filterEndDate
      );
    }

    // Apply sorting
    processedLogs = sortLogs(processedLogs, sortBy, sortOrder);

    return processedLogs;
  }, [
    logs,
    searchTerm,
    filterType,
    filterStartDate,
    filterEndDate,
    applyDateFilter,
    sortBy,
    sortOrder,
  ]);

  const handleDateFilterApply = () => {
    setApplyDateFilter(true);
  };

  const handleDateFilterClear = () => {
    setFilterStartDate('');
    setFilterEndDate('');
    setApplyDateFilter(false);
  };

  const toggleSortOrder = () => {
    setSortOrder((prevOrder) => (prevOrder === 'asc' ? 'desc' : 'asc'));
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterType('');
    setFilterStartDate('');
    setFilterEndDate('');
    setApplyDateFilter(false);
    setSortBy('timestamp'); // Reset to default sort key
    setSortOrder('desc'); // Reset to default sort order
    // Optionally hide filters on reset:
    // setShowFilters(false);
  };

  return (
    <div className="status-log-menu border p-3 bg-light">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="mb-0">Status Logs</h6>
        <Button close onClick={onClose} title="Close Status Logs" />
      </div>

      {/* Toggle Button for Filters */}
      <LogFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filterType={filterType}
        setFilterType={setFilterType}
        filterStartDate={filterStartDate}
        setFilterStartDate={setFilterStartDate}
        filterEndDate={filterEndDate}
        setFilterEndDate={setFilterEndDate}
        applyDateFilter={applyDateFilter}
        setApplyDateFilter={setApplyDateFilter}
        handleDateFilterApply={handleDateFilterApply}
        handleDateFilterClear={handleDateFilterClear}
        sortOrder={sortOrder}
        toggleSortOrder={toggleSortOrder}
        handleResetFilters={handleResetFilters}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
      />

      {loading && (
        <div className="text-center">
          <Spinner size="sm" /> Loading logs...
        </div>
      )}

      {error && <Alert color="danger">Error: {error}</Alert>}

      {!loading && !error && (
        <ListGroup flush style={{ maxHeight: '250px', overflowY: 'auto' }}>
          {filteredSortedLogs.length > 0 ? (
            filteredSortedLogs.map((log, index) => (
              <ListGroupItem
                key={log._id || index}
                className="d-flex justify-content-between align-items-center p-1"
                style={{ fontSize: '0.85em' }}
              >
                <span style={{ flexGrow: 1, marginRight: '10px' }}>
                  <strong>{log.statusType}:</strong>{' '}
                  {log.details || 'No details'}
                </span>
                <small className="text-muted">
                  {formatTimestamp(log.timestamp)}
                </small>
              </ListGroupItem>
            ))
          ) : (
            <ListGroupItem className="text-muted p-1">
              {logs.length === 0
                ? 'No status logs found for this character.'
                : 'No logs match the current filters.'}
            </ListGroupItem>
          )}
        </ListGroup>
      )}
    </div>
  );
};

StatusLogMenu.propTypes = {
  /**
   * The MongoDB ID of the character whose logs are being displayed. This ID is
   * used to fetch the relevant status logs from the backend API.
   */
  characterId: PropTypes.string.isRequired,
  /**
   * Callback function executed when the close button (typically an 'X') in
   * the component's header is clicked. Used to signal that the menu should
   * be hidden or dismissed.
   */
  onClose: PropTypes.func.isRequired,
};

export default StatusLogMenu;
