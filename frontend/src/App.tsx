import React, { useState, useCallback, useMemo, ChangeEvent, FormEvent } from 'react';
import './App.css';

// --- Type Definitions ---

// Define the structure of the form data
interface FormData {
  Age: string | number; // Allow string during input, number for processing
  Height: string | number;
  Weight: string | number;
  Duration: string | number;
  Heart_Rate: string | number;
  Body_Temp: string | number;
  Sex: 'male' | 'female'; // Use specific literal types
}

// Define the structure for validation errors (key matches FormData, value is string or null)
type FormErrors = {
  [K in keyof FormData]?: string | null; // Optional error message for each field
};

// Define the expected structure of the backend API success response
interface ApiPredictionResponse {
  predicted_calories: number;
}

// Define the expected structure of the backend API error response
interface ApiErrorResponse {
  error: string;
}


// --- Initial State ---
const initialFormData: FormData = {
  Age: '',
  Height: '',
  Weight: '',
  Duration: '',
  Heart_Rate: '',
  Body_Temp: '',
  Sex: 'male', // Default value
};

function App(): JSX.Element { // Explicit return type for the component
  // --- State Variables with Types ---
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  // --- Memoized API URL ---
  const apiUrl = useMemo<string>(() => import.meta.env.VITE_API_URL || 'http://localhost:5001/predict', []);

  // --- Input Change Handler with Event Type ---
  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;

    // Use type assertion for the key, as 'name' comes from DOM element attribute
    const fieldName = name as keyof FormData;

    setFormData(prevState => ({
      ...prevState,
      [fieldName]: value
    }));

    // Clear validation error for the field being changed
    if (formErrors[fieldName]) {
      setFormErrors(prevErrors => {
          const newErrors = { ...prevErrors };
          delete newErrors[fieldName];
          return newErrors;
      });
    }
  }, [formErrors]); // formErrors is a dependency

  // --- Client-Side Form Validation ---
   const validateForm = useCallback((): boolean => { // Explicit return type
    const errors: FormErrors = {};
    // Fields that must be positive numbers
    const positiveNumericFields: (keyof FormData)[] = ['Age', 'Height', 'Weight', 'Duration', 'Heart_Rate'];
    // Body temp can be different
    const numericFields: (keyof FormData)[] = [...positiveNumericFields, 'Body_Temp'];

    numericFields.forEach(field => {
      const value = formData[field];
      const label = field.replace(/_/g, ' ');

      if (value === '' || value === null) {
        errors[field] = `${label} is required.`;
      } else {
          const numValue = Number(value);
          if (isNaN(numValue)) {
            errors[field] = `${label} must be a valid number.`;
          } else if (positiveNumericFields.includes(field) && numValue <= 0) {
            errors[field] = `${label} must be greater than zero.`;
          }
          // Add specific validation for Body_Temp if needed (e.g., range)
      }
    });

    if (!formData.Sex) { // Should have default, but good practice
        errors.Sex = 'Sex is required.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0; // Returns true if no errors
  }, [formData]);


  // --- Form Submission Handler with Event Type ---
  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setApiError(null);
    setPrediction(null);

    if (!validateForm()) {
      console.warn("Form validation failed:", formErrors);
      return;
    }

    setIsLoading(true);
    console.log("Sending data to backend:", formData);
    console.log("Using API URL:", apiUrl);

    try {
      // Prepare data ensuring numbers are numbers
      const dataToSend = {
        Age: Number(formData.Age),
        Height: Number(formData.Height),
        Weight: Number(formData.Weight),
        Duration: Number(formData.Duration),
        Heart_Rate: Number(formData.Heart_Rate),
        Body_Temp: Number(formData.Body_Temp),
        Sex: formData.Sex,
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      });

      // Try to parse JSON regardless of status code, backend might send error details
       let responseBody: ApiPredictionResponse | ApiErrorResponse | any; // Use 'any' carefully or define more error types
       try {
            responseBody = await response.json();
       } catch (jsonError) {
            // Handle cases where response is not JSON (e.g., plain text 500 error)
            console.error("Could not parse response JSON:", jsonError);
            // Throw a generic error based on status if JSON parsing fails
            throw new Error(`Request failed: ${response.status} ${response.statusText}. Unable to parse server response.`);
       }


      if (!response.ok) {
        // Check if the parsed body has an 'error' property (conforms to ApiErrorResponse)
        if (responseBody && typeof responseBody === 'object' && 'error' in responseBody) {
             throw new Error((responseBody as ApiErrorResponse).error);
        } else {
            // Fallback error message
            throw new Error(`Request failed: ${response.status} ${response.statusText}`);
        }
      }

       // Check if the successful response has the expected prediction property
      if (typeof responseBody === 'object' && 'predicted_calories' in responseBody) {
           setPrediction((responseBody as ApiPredictionResponse).predicted_calories);
      } else {
          console.error("Invalid success response structure:", responseBody);
          throw new Error("Prediction value missing or invalid in the API response.");
      }

    } catch (err) {
      console.error("Prediction API call failed:", err);
      // Check if err is an instance of Error to safely access message
      if (err instanceof Error) {
          setApiError(err.message);
      } else {
          setApiError("An unknown error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [formData, apiUrl, validateForm, formErrors]); // Dependencies

  // --- Form Reset Handler ---
  const handleReset = useCallback(() => {
    setFormData(initialFormData);
    setPrediction(null);
    setApiError(null);
    setFormErrors({});
  }, []); // No dependencies needed if initialFormData is stable

  // --- JSX Rendering ---
  return (
    <div className="App">
      <header className="App-header">
        <h1>🔥 Calorie Burn Predictor</h1>
        <p>Enter exercise details to estimate calorie expenditure.</p>
      </header>

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-grid">

          {/* Numerical Inputs */}
          {/* Note: value is bound to formData which can be string or number, */}
          {/* HTML input type="number" handles display */}
          <div className="form-group">
            <label htmlFor="Age">Age (years)</label>
            <input type="number" id="Age" name="Age" value={formData.Age} onChange={handleChange} required min="1" step="1" aria-invalid={!!formErrors.Age} aria-describedby="age-error"/>
            {formErrors.Age && <span id="age-error" className="validation-error">{formErrors.Age}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="Height">Height (cm)</label>
            <input type="number" id="Height" name="Height" value={formData.Height} onChange={handleChange} required min="1" step="0.1" aria-invalid={!!formErrors.Height} aria-describedby="height-error"/>
             {formErrors.Height && <span id="height-error" className="validation-error">{formErrors.Height}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="Weight">Weight (kg)</label>
            <input type="number" id="Weight" name="Weight" value={formData.Weight} onChange={handleChange} required min="1" step="0.1" aria-invalid={!!formErrors.Weight} aria-describedby="weight-error"/>
             {formErrors.Weight && <span id="weight-error" className="validation-error">{formErrors.Weight}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="Duration">Duration (minutes)</label>
            <input type="number" id="Duration" name="Duration" value={formData.Duration} onChange={handleChange} required min="1" step="1" aria-invalid={!!formErrors.Duration} aria-describedby="duration-error"/>
             {formErrors.Duration && <span id="duration-error" className="validation-error">{formErrors.Duration}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="Heart_Rate">Avg Heart Rate (bpm)</label>
            <input type="number" id="Heart_Rate" name="Heart_Rate" value={formData.Heart_Rate} onChange={handleChange} required min="1" step="1" aria-invalid={!!formErrors.Heart_Rate} aria-describedby="hr-error"/>
             {formErrors.Heart_Rate && <span id="hr-error" className="validation-error">{formErrors.Heart_Rate}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="Body_Temp">Avg Body Temp (°C)</label>
            <input type="number" id="Body_Temp" name="Body_Temp" value={formData.Body_Temp} onChange={handleChange} required step="0.1" aria-invalid={!!formErrors.Body_Temp} aria-describedby="temp-error"/>
             {formErrors.Body_Temp && <span id="temp-error" className="validation-error">{formErrors.Body_Temp}</span>}
          </div>

          {/* Categorical Input */}
          <div className="form-group form-group-span-2">
            <label htmlFor="Sex">Biological Sex</label>
            <select id="Sex" name="Sex" value={formData.Sex} onChange={handleChange} required aria-invalid={!!formErrors.Sex} aria-describedby="sex-error">
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
             {formErrors.Sex && <span id="sex-error" className="validation-error">{formErrors.Sex}</span>}
          </div>
        </div>

        {/* --- Action Buttons --- */}
        <div className="form-actions">
          <button type="submit" className="button-primary" disabled={isLoading}>
            {isLoading ? 'Predicting...' : 'Predict Calories'}
          </button>
          <button type="button" className="button-secondary" onClick={handleReset} disabled={isLoading}>
            Reset Form
          </button>
        </div>
      </form>

      {/* --- Display API Error Message --- */}
      {apiError && (
         <div className="error-message api-error" role="alert">
            <strong>Error:</strong> {apiError}
        </div>
       )}

      {/* --- Display Prediction Result --- */}
      {prediction !== null && !apiError && (
        <div className="prediction-result" role="status">
          <h2>Estimated Calories Burned:</h2>
          <p className="prediction-value">
            {/* Format number if desired */}
            {prediction}
            <span className="prediction-unit"> kcal</span>
          </p>
          <small>This is an estimate based on the provided data and model.</small>
        </div>
      )}

    </div> // End App div
  );
}

export default App;