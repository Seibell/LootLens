const Tesseract = require('tesseract.js');
const filename = "pic.png";

Tesseract.recognize(
  filename,
  'eng',
  { logger: m => console.log(m) }
).then(({ data: { text } }) => {
  console.log(text);
});
