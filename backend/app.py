# backend/app.py
import os
import joblib
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS

# --- Configuration ---
# Determine the absolute path to the directory containing this script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, 'calorie_model.joblib')
ENCODER_PATH = os.path.join(BASE_DIR, 'sex_encoder.joblib')
FEATURES_PATH = os.path.join(BASE_DIR, 'feature_names.joblib')

# --- Initialize Flask App ---
app = Flask(__name__)
CORS(app)  # Enable Cross-Origin Resource Sharing

# --- Load Artifacts ---
try:
    model = joblib.load(MODEL_PATH)
    encoder = joblib.load(ENCODER_PATH)
    feature_names = joblib.load(FEATURES_PATH)
    print("✅ Model, Encoder, and Feature Names loaded successfully!")
    print(f"🔢 Expected features: {feature_names}")
except FileNotFoundError as e:
    print(f"❌ Error loading artifacts: {e}")
    print("Ensure 'calorie_model.joblib', 'sex_encoder.joblib', and 'feature_names.joblib' are in the same directory as app.py")
    # You might want to exit or handle this more gracefully in production
    model = None
    encoder = None
    feature_names = None
except Exception as e:
    print(f"❌ An unexpected error occurred during loading: {e}")
    model = None
    encoder = None
    feature_names = None

# --- Define API Endpoint ---
@app.route('/predict', methods=['POST'])
def predict():
    if not model or not encoder or not feature_names:
         return jsonify({"error": "Model or supporting files not loaded. Check backend logs."}), 500

    try:
        data = request.get_json()
        print(f"Received data: {data}") # Log received data for debugging

        # --- Input Validation (Basic) ---
        required_keys = ['Age', 'Height', 'Weight', 'Duration', 'Heart_Rate', 'Body_Temp', 'Sex']
        if not all(key in data for key in required_keys):
            missing = [key for key in required_keys if key not in data]
            return jsonify({"error": f"Missing required fields: {missing}"}), 400

        # --- Data Preprocessing ---
        # Create a DataFrame from the input data
        input_df = pd.DataFrame([data]) # Needs to be a list of dicts for DataFrame constructor

        # Separate categorical and numerical - based on YOUR training setup
        categorical_cols = ['Sex']
        numerical_cols = ['Age', 'Height', 'Weight', 'Duration', 'Heart_Rate', 'Body_Temp']

        # Handle numerical types explicitly
        for col in numerical_cols:
             try:
                 input_df[col] = pd.to_numeric(input_df[col])
             except ValueError:
                 return jsonify({"error": f"Invalid non-numeric value for '{col}': {input_df[col].iloc[0]}"}), 400


        # Apply the loaded OneHotEncoder
        encoded_cats = encoder.transform(input_df[categorical_cols])
        encoded_cats_df = pd.DataFrame(encoded_cats, columns=encoder.get_feature_names_out(categorical_cols), index=input_df.index)

        # Combine numerical and encoded categorical features
        processed_df = pd.concat([input_df[numerical_cols], encoded_cats_df], axis=1)

        # !!! CRITICAL: Ensure columns are in the exact same order as training !!!
        # Reindex the processed_df using the loaded feature_names
        try:
            processed_df = processed_df.reindex(columns=feature_names)
        except ValueError as e:
             print(f"❌ Error during reindexing: {e}")
             print(f"    Processed columns: {list(processed_df.columns)}")
             print(f"    Expected columns: {feature_names}")
             # This usually means a mismatch between input keys and expected features
             # Or an issue with the loaded feature_names list.
             return jsonify({"error": "Feature mismatch during preprocessing. Check backend logs."}), 500


        print(f"Processed DataFrame for prediction:\n{processed_df}") # Log processed data

        # --- Prediction ---
        prediction = model.predict(processed_df)

        # Handle potential negative predictions (as done in training)
        prediction_non_negative = np.maximum(0, prediction[0]) # Get the single prediction value

        print(f"Predicted value: {prediction_non_negative}") # Log prediction

        # --- Return Response ---
        return jsonify({'predicted_calories': round(prediction_non_negative, 2)}) # Round for display

    except KeyError as e:
         print(f"❌ KeyError during processing: {e}")
         return jsonify({"error": f"Invalid or missing key in input data: {e}"}), 400
    except Exception as e:
        print(f"❌ An unexpected error occurred during prediction: {e}")
        # Log the full traceback in a real application for debugging
        import traceback
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred. Check backend logs."}), 500

# --- Run the App (for local development) ---

if __name__ == '__main__':
    # Use a different port, e.g., 5001
    app.run(host='0.0.0.0', port=5001, debug=True)
