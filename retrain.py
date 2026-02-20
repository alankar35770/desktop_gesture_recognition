import os
import json
import pickle
import pandas as pd
import numpy as np

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import accuracy_score, classification_report
from landmark_utils import normalize_landmarks_row

DATASET_DIR = "datasets"
MODELS_DIR = "models"

CSV_FILE = os.path.join(DATASET_DIR, "gesture_landmarks.csv")
MODEL_FILE = os.path.join(MODELS_DIR, "gesture_knn_model.pkl")
SCALER_FILE = os.path.join(MODELS_DIR, "gesture_scaler.pkl")
CLASS_FILE = os.path.join(MODELS_DIR, "class_names_knn.json")

K = 5

def initialize():
    if not os.path.exists(MODELS_DIR):
        os.makedirs(MODELS_DIR)
    if not os.path.exists(CSV_FILE):
        print("ERROR: Dataset not found.")
        print("Collect data first via dashboard or collector script.")
        

def load_dataset():
    print("\nLoading dataset...")
    df = pd.read_csv(CSV_FILE)
    if len(df) < 10:
        print("ERROR: Not enough samples.")
        return None, None, None
    labels      = df.iloc[:, 0]
    raw         = df.iloc[:, 1:].values.astype(float)
    features    = np.array([normalize_landmarks_row(row) for row in raw])
    class_names = sorted(labels.unique())
    label_to_index = {label: i for i, label in enumerate(class_names)}
    y = np.array([label_to_index[label] for label in labels])
    X = features
    print(f"Samples loaded: {len(X)}")
    print(f"Classes found: {class_names}")
    return X, y, class_names

def train_model(X, y):
    print("\nSplitting dataset...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print("Scaling features...")
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test = scaler.transform(X_test)
    print("Training KNN model...")
    knn = KNeighborsClassifier(n_neighbors=K, weights='distance', metric='euclidean')
    knn.fit(X_train, y_train)
    print("Testing model...")
    y_pred = knn.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    print(f"\nAccuracy: {accuracy * 100:.2f}%")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))
    return knn, scaler

def save_model(knn, scaler, class_names):
    print("\nSaving model...")
    with open(MODEL_FILE, "wb") as f:
        pickle.dump(knn, f)
    with open(SCALER_FILE, "wb") as f:
        pickle.dump(scaler, f)
    with open(CLASS_FILE, "w") as f:
        json.dump(class_names, f, indent=4)
    print("\nSaved files:")
    print(MODEL_FILE)
    print(SCALER_FILE)
    print(CLASS_FILE)

def main():
    initialize()
    X, y, class_names = load_dataset()
    if X is None:
        print("Cannot train - no valid dataset.")
        return
    knn, scaler = train_model(X, y)
    save_model(knn, scaler, class_names)
    print("\nRetraining complete.")

if __name__ == "__main__":
    main()