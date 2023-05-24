const express = require('express');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const Jimp = require('jimp');
const Fuse = require('fuse.js');

const app = express();
const port = process.env.PORT || 3000;

// Configure Multer to handle file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Serve the frontend HTML file
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Serve the images folder statically
app.use(express.static('public'));

// Preprocess the image
async function preprocessImage(image) {
  const newWidth = Math.round(image.getWidth() * 1.23);
  const newHeight = Math.round(image.getHeight() * 1.5);

  // Resize the image
  image.resize(newWidth, newHeight);

  // Apply contrast adjustment
  image.contrast(0.69);

  // Convert the image to grayscale
  image.greyscale();

  // Binarize the image with a threshold of 128
  image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
    const red = this.bitmap.data[idx + 0];
    const green = this.bitmap.data[idx + 1];
    const blue = this.bitmap.data[idx + 2];
    const average = (red + green + blue) / 3;
    const binaryValue = average > 128 ? 255 : 0;
    this.bitmap.data[idx + 0] = binaryValue;
    this.bitmap.data[idx + 1] = binaryValue;
    this.bitmap.data[idx + 2] = binaryValue;
  });

  return image;
}

// Define expected texts and their corresponding buckets
const expectedTexts = [
  { text: 'You got Black Resurrection', bucket: 'Black Resurrection Flame', value: '200000000' },
  { text: 'You got Rainbow Resurrection', bucket: 'Rainbow Resurrection Flame', value: '150000000' },
  { text: 'You got Crimson Resurrection', bucket: 'Crimson Resurrection Flame', value: '50000000' },
  { text: 'You got Unextinguished x2', bucket: 'Unextinguished Flame x2', value: '16000000' },
  { text: 'You got Unextinguished x1', bucket: 'Unextinguished Flame x1', value: '8000000' },
  { text: 'You got Never-extinguishing', bucket: 'Never-extinguishing Flame', value: '25000000' },
  { text: 'You got Black never-extinguishing', bucket: 'Black Never-extinguishing Flame', value: '25000000' },
  { text: 'You got Sparkling Red', bucket: 'Sparkling Red Potion', value: '8000000' },
  { text: 'You got Sparkling Blue', bucket: 'Sparkling Blue Potion', value: '1500000' },
  { text: 'You got Amazingly Positive Chaos', bucket: 'Amazingly Positive Chaos Scroll 60%', value: '35000000' },
  { text: 'You got Large Boss Medal of Honor', bucket: 'Large Boss Medal of Honor', value: '10000000' },
  { text: 'You got Additional 50% EXP', bucket: 'Additional 50% EXP Coupon', value: '4000000' },
  { text: 'You got Small EXP Accumulation', bucket: 'Small EXP Accumulation Potion', value: '8000000' },
  { text: 'You got Suspicious Additional Cube x2', bucket: 'Suspicious Additional Cube x2', value: '4000000' },
];

// Perform fuzzy matching to determine the bucket for the given text
function matchTextToBucket(text) {
  const options = {
    keys: ['text'],
    threshold: 0.5, // Adjust the threshold as needed
  };

  const fuse = new Fuse(expectedTexts, options);
  const result = fuse.search(text);

  if (result.length > 0) {
    return result[0].item.bucket; // Return the bucket of the best match
  } else {
    return null; // Return null if no significant match is found
  }
}

app.post('/upload', upload.array('images'), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    res.status(400).send('No files uploaded');
    return;
  }

  console.log("Uploading Images...");
  const fileBuffers = req.files.map(file => file.buffer);

  try {
    // Map fileBuffers to an array of promises
    const ocrPromises = fileBuffers.map(async buffer => {
      // Load the buffer into a Jimp image
      const image = await Jimp.read(buffer);

      // Preprocess the image
      const processedImage = await preprocessImage(image);

      // Get a buffer from the processed image
      const processedBuffer = await processedImage.getBufferAsync(Jimp.AUTO);

      // Perform OCR on the processed buffer
      const { data: { text } } = await Tesseract.recognize(processedBuffer, 'eng');

      console.log('OCR Result:', text);

      // Extract lines of text and map them to buckets
      const lines = text.split('\n');
      return lines.map(line => {
        const bucket = matchTextToBucket(line);
        return { line, bucket };
      });
    });

    // Await all OCR promises to resolve
    const extractedTexts = await Promise.all(ocrPromises);
    // Flatten the array
    const flatExtractedTexts = extractedTexts.flat();

    console.log('Extracted Texts:', flatExtractedTexts);

    // Count the occurrences of each bucket
    const bucketCounts = {};
    flatExtractedTexts.forEach(({ bucket }) => {
      if (bucket) {
        if (bucketCounts[bucket]) {
          bucketCounts[bucket]++;
        } else {
          bucketCounts[bucket] = 1;
        }
      }
    });

    console.log('Bucket Counts:', bucketCounts);

    res.json(bucketCounts);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error performing OCR');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
