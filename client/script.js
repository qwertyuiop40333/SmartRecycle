// ✅ Teachable Machine model links
const modelURL = "https://teachablemachine.withgoogle.com/models/6JgamZ-iE/model.json";
const metadataURL = "https://teachablemachine.withgoogle.com/models/6JgamZ-iE/metadata.json";

let model, maxPredictions;
let userLocation = { lat: null, lng: null }; // ✅ Global location object

// Load model
async function loadModel() {
  model = await tmImage.load(modelURL, metadataURL);
  maxPredictions = model.getTotalClasses();
  console.log("✅ AI model loaded");
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("uploadForm");
  const imageBefore = document.getElementById("wasteImageBefore");
  const imageAfter = document.getElementById("wasteImageAfter");
  const usernameInput = document.getElementById("username");
  const preview = document.getElementById("preview");
  const status = document.getElementById("status");
  const locStatus = document.getElementById("locationStatus");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const file1 = imageBefore.files[0];
    const file2 = imageAfter.files[0];
    const username = usernameInput.value.trim();

    if (!file1 || !file2 || !username) {
      status.textContent = "⚠ Please fill in username and upload both images!";
      return;
    }

    // ✅ Extract GPS from EXIF
    const extractLocationFromExif = (file) => {
      return new Promise((resolve) => {
        EXIF.getData(file, function () {
          const lat = EXIF.getTag(this, "GPSLatitude");
          const lon = EXIF.getTag(this, "GPSLongitude");
          const latRef = EXIF.getTag(this, "GPSLatitudeRef") || "N";
          const lonRef = EXIF.getTag(this, "GPSLongitudeRef") || "E";

          if (lat && lon) {
            const toDecimal = (dms, ref) => {
              const [d, m, s] = dms;
              let dec = d + m / 60 + s / 3600;
              return (ref === "S" || ref === "W") ? -dec : dec;
            };
            const latitude = toDecimal(lat, latRef);
            const longitude = toDecimal(lon, lonRef);
            resolve({ lat: latitude, lng: longitude });
          } else {
            resolve(null);
          }
        });
      });
    };

    let locationFromExif = await extractLocationFromExif(file1);

    // ✅ Fallback to browser GPS
    if (locationFromExif) {
      userLocation = locationFromExif;
      locStatus.textContent = `📍 Extracted from photo: (${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)})`;
    } else if ("geolocation" in navigator) {
      await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            userLocation.lat = pos.coords.latitude;
            userLocation.lng = pos.coords.longitude;
            locStatus.textContent = `📍 Using current location: (${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)})`;
            resolve();
          },
          (error) => {
            locStatus.textContent = "⚠ Location not available.";
            resolve();
          }
        );
      });
    } else {
      locStatus.textContent = "⚠ No GPS info found.";
    }

    // ✅ Read both images
    const reader1 = new FileReader();
    const reader2 = new FileReader();

    reader1.onload = () => {
      const base64ImageBefore = reader1.result;
      preview.innerHTML = `<p><strong>Before (with waste):</strong><br><img id="previewImage" src="${base64ImageBefore}" style="max-width: 300px;"></p>`;

      reader2.onload = async () => {
        const base64ImageAfter = reader2.result;
        preview.innerHTML += `<p><strong>After (cleaned):</strong><br><img src="${base64ImageAfter}" style="max-width: 300px;"></p>`;

        const previewImage = document.getElementById("previewImage");

        if (!model) {
          status.textContent = "⏳ Loading AI model...";
          await loadModel();
        }

        status.textContent = "🤖 Running AI classification...";
        const prediction = await model.predict(previewImage);
        const topPrediction = prediction.reduce((best, current) =>
          current.probability > best.probability ? current : best
        );

        const wasteType = topPrediction.className.toLowerCase();
        const confidence = topPrediction.probability;

        status.textContent = `♻ Waste Type: ${wasteType} (Confidence: ${(confidence * 100).toFixed(2)}%)`;

        // ✅ Send to backend
        try {
          const response = await fetch("http://localhost:3000/api/compare-images", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              username,
              imageBefore: base64ImageBefore,
              imageAfter: base64ImageAfter,
              wasteType,
              confidence,
              location: {
                lat: userLocation.lat,
                lng: userLocation.lng,
              },
            }),
          });

          const result = await response.json();
          let points = result.points || 0;
          let finalStatus = result.status || "Failed";
          let sim = result.similarity ? ` (Similarity: ${result.similarity.toFixed(2)})` : "";

          status.textContent += `\n✅ Status: ${finalStatus} | Points: ${points}${sim}`;
        } catch (err) {
          console.error("❌ Error sending to backend:", err);
          status.textContent += " ❌ Failed to connect to backend.";
        }
      };

      reader2.readAsDataURL(file2);
    };

    reader1.readAsDataURL(file1);
  });
});
