/**
 * @file Login.jsx
 * @description User authentication component that handles login functionality.
 *   Provides a form for entering credentials, validates inputs, and
 *   handles authentication API calls. Includes error handling and success
 *   feedback.
 * @module components/auth/Login
 */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { useFormik } from 'formik';
import {
  Button,
  Card,
  CardBody,
  Col,
  Form,
  FormGroup,
  Input,
  Label,
  Row,
} from 'reactstrap';
import { v4 as uuidv4 } from 'uuid';
import { useUser } from '../context/UserProvider';
import { handleError } from '../../utils/errorHandler.js';
// Direct console calls are used instead of logger;

/**
 * Login component that handles user authentication. Manages form state,
 * validation, and authentication API calls.
 *
 * @param {object} props - Component props.
 * @param {Function} props.cancelHandler - Callback function invoked when the
 *   user cancels login.
 * @param {Function} props.completedHandler - Callback function invoked after
 *   successful login.
 * @returns {React.ReactElement} The rendered login form.
 */
function Login({ cancelHandler, completedHandler }) {
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [errors, setErrors] = useState([]);

  const { login } = useUser();

  const formik = useFormik({
    initialValues: {
      username: '',
      password: '',
    },

    validate: (values) => {
      const errors = {};
      if (!values.username) errors.username = 'Required';
      else if (values.username.length < 3)
        errors.username = 'Must be 3 characters or more';
      if (!values.password) errors.password = 'Required';
      else if (values.password.length < 3)
        errors.password = 'Must be 3 characters or more';
      return errors;
    },

    onSubmit: async (values, { setSubmitting }) => {
      setIsSubmitted(false);
      setErrors([]);
      setSubmitting(true);
      try {
        await login({
          username: values.username,
          password: values.password,
        });

        setIsSubmitted(true);
        setTimeout(() => {
          setIsSubmitted(false);
          completedHandler();
        }, 200);
      } catch (e) {
        let errorMessages = [];
        const timestamp = new Date().toISOString();
        handleError(e, {
          context: 'Login.onSubmit',
          payload: { username: values.username }, // Don't log password
          onError: (handledError, context) => {
            console.error(
              `[${timestamp}] [ERROR] [Login]: Error during login for ` +
              `${values.username}:`,
              context.message || handledError.message
            );
            // Set user-facing error messages based on the error
            if (handledError instanceof Error) {
              if (handledError.message.includes('Invalid username/password')) {
                errorMessages = ['Invalid username or password.'];
              } else if (handledError.message.includes('Could not connect')) {
                errorMessages = ['Could not connect to the server.'];
              } else {
                errorMessages = [
                  handledError.message || 'An unexpected error occurred.',
                ];
              }
            } else {
              errorMessages = [
                'An unexpected error occurred. Please try again.',
              ];
            }
            setErrors(errorMessages);
          },
        });
      } finally {
        setSubmitting(false);
      }
    },
  });

  return (
    <Row className="justify-content-center" style={{ width: '100%' }}>
      <Col md="8">
        <Card className="my-4 bg-secondary text-white bg-opacity-25">
          <div className="divider-container">
            <div className="divider-line" />
            <span className="divider-text">
              <h3>Log In</h3>
            </span>
            <div className="divider-line" />
          </div>
          <CardBody>
            <Form onSubmit={formik.handleSubmit}>
              <FormGroup>
                <Label for="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  onChange={formik.handleChange}
                  value={formik.values.username}
                  autoComplete="username"
                />
                {formik.errors.username ? (
                  <div>{formik.errors.username}</div>
                ) : null}
              </FormGroup>
              <FormGroup>
                <Label for="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  onChange={formik.handleChange}
                  value={formik.values.password}
                  autoComplete="current-password"
                />
                {formik.errors.password ? (
                  <div>{formik.errors.password}</div>
                ) : null}
              </FormGroup>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '1rem',
                }}
              >
                <Button className="btn btn-danger" onClick={cancelHandler}>
                  Cancel
                </Button>
                <Button type="submit" color="primary">
                  {isSubmitted ? 'Success!' : 'Login'}
                </Button>
              </div>
            </Form>
            {errors.length > 0 && (
              <div className="alert alert-danger mt-3">
                <ul>
                  {errors.map((error) => (
                    <li key={uuidv4()}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>
      </Col>
    </Row>
  );
}

Login.propTypes = {
  /**
   * Callback function invoked when the user cancels login.
   */
  cancelHandler: PropTypes.func.isRequired,

  /**
   * Callback function invoked after successful login.
   */
  completedHandler: PropTypes.func.isRequired,
};

export default Login;
