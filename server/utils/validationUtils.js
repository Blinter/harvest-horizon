/**
 * @file Validation Utilities
 * @module server/utils/validationUtils
 * @description Provides utility functions for handling validation, primarily
 *   formatting errors from libraries like `jsonschema`.
 */
import { BadRequestError } from '../expressError.js';

/**
 * Formats `jsonschema` validation errors into user-friendly messages.
 *
 * @param {Array<object>} errors - Array of validation error objects from
 *   `jsonschema`. Each object details a specific validation failure.
 * @returns {string} A comma-separated string of formatted, user-friendly
 *   error messages derived from the input errors.
 * @throws {BadRequestError} Always throws a `BadRequestError` containing
 *   the concatenated, formatted error messages. This indicates issues
 *   with the client's request data based on schema validation.
 */
function formatValidationErrors(errors) {
  const errorMessages = errors.map((e) => {
    const field = e.property.replace('instance.', ''); // Get field name

    // Required fields
    if (e.name === 'required') {
      return `Missing required field: ${e.argument}`;
    }

    // Email format/pattern
    if (field === 'email' && (e.name === 'pattern' || e.name === 'format')) {
      return 'Please provide a valid email address.';
    }

    // Length constraints
    if (e.name === 'minLength') {
      return (
        `${field.charAt(0).toUpperCase() + field.slice(1)} must be at ` +
        `least ${e.argument} characters long.`
      );
    }
    if (e.name === 'maxLength') {
      return (
        `${field.charAt(0).toUpperCase() + field.slice(1)} must be no ` +
        `more than ${e.argument} characters long.`
      );
    }

    // Prevent extra fields
    if (e.name === 'additionalProperties') {
      return `Invalid field provided: ${e.argument}.`;
    }

    // Default message for other errors
    return e.message;
  });

  console.debug(
    `[${new Date().toISOString()}] [DEBUG]: Validation errors mapped:`,
    errorMessages
  );
  // Throw a single error with all messages joined
  throw new BadRequestError(`${errorMessages.join(', ')}`);
}

export { formatValidationErrors };
