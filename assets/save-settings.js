var model = require("./settings-model.js");

if (process.argv.length !== 9) {
  console.error("Ongeldige instelling.");
  process.exit(1);
}

try {
  var settings = model.sanitize({
    met: process.argv[2],
    artic: process.argv[3],
    rijks: process.argv[4],
    rijksKey: process.argv[5],
    imageSize: process.argv[6],
    veil: process.argv[7],
    durationSec: process.argv[8]
  });
  model.save(settings);
  console.log("Instellingen opgeslagen.");
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
