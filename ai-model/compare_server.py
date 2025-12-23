from flask import Flask, request, jsonify
from PIL import Image
import torch
import torchvision.transforms as transforms
import torchvision.models as models
import torch.nn.functional as F
from io import BytesIO
import base64

app = Flask(__name__)  # ✅ Corrected __name__

# ✅ Load pretrained ResNet model
model = models.resnet50(pretrained=True)
model.eval()

# ✅ Preprocessing: Resize and convert to tensor
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
])

def get_features(base64_str):
    """Decode base64 image and extract features using ResNet."""
    img_bytes = BytesIO(base64.b64decode(base64_str.split(",")[-1]))
    image = Image.open(img_bytes).convert("RGB")
    tensor = transform(image).unsqueeze(0)
    with torch.no_grad():
        features = model(tensor)
    return features

@app.route("/compare", methods=["POST"])
def compare_images():
    data = request.json
    try:
        feat1 = get_features(data["imageBefore"])
        feat2 = get_features(data["imageAfter"])
        similarity = F.cosine_similarity(feat1, feat2).item()
        return jsonify({
            "similarity": similarity,
            "status": "Passed" if similarity > 0.5 else "Failed"
        })
    except Exception as e:
        print("❌ Error comparing images:", e)
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":  # ✅ Corrected main check
    app.run(port=5001)
