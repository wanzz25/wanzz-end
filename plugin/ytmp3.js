const axios = require("axios");
const crypto = require("crypto");

function getSecretKeyHex() {
  return "C5D58EF67A7584E4A29F6C35BBC4EB12";
}

function decryptData(encryptedBase64) {
  const keyHex = getSecretKeyHex();
  const key = Buffer.from(keyHex, "hex");

  const encryptedBuffer = Buffer.from(encryptedBase64.replace(/\s/g, ""), "base64");
  const iv = encryptedBuffer.subarray(0, 16);
  const ciphertext = encryptedBuffer.subarray(16);

  const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
  let decrypted = decipher.update(ciphertext, null, "utf8");
  decrypted += decipher.final("utf8");

  return JSON.parse(decrypted);
}

const ytHeaders = {
  "host": "cdn403.savetube.vip",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:153.0) Gecko/20100101 Firefox/153.0",
  "accept": "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  "content-type": "application/json",
  "origin": "https://y2mate.net.co",
  "referer": "https://y2mate.net.co/",
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "cross-site"
};

async function getInfo(youtubeUrl) {
  const response = await axios.post(
    "https://cdn403.savetube.vip/v2/info",
    { url: youtubeUrl },
    { headers: ytHeaders }
  );
  return response.data;
}

async function getDownload(downloadType, quality, key) {
  const response = await axios.post(
    "https://cdn403.savetube.vip/download",
    { downloadType, quality, key },
    {
      headers: {
        ...ytHeaders,
        "accept": "*/*",
        "priority": "u=4"
      }
    }
  );
  return response.data;
}

async function processMedia(youtubeUrl, downloadType = "audio", quality = "128") {
  const infoRes = await getInfo(youtubeUrl);

  if (!infoRes?.data) {
    throw new Error("Gagal mendapatkan data respon dari /v2/info");
  }

  const decryptedMetaData = decryptData(infoRes.data);
  const extractedKey = decryptedMetaData?.key;

  if (!extractedKey) {
    throw new Error("Gagal mengekstrak key dari data terdekripsi");
  }

  const downloadRes = await getDownload(downloadType, quality, extractedKey);

  return {
    title: decryptedMetaData.title,
    duration: decryptedMetaData.durationLabel,
    downloadUrl: downloadRes?.data?.downloadUrl,
    downloaded: downloadRes?.data?.downloaded
  };
}

module.exports = {
  name: "Youtube Mp3 Downloader",
  desc: "Download audio (mp3) dari video Youtube dengan pilihan kualitas.",
  category: "Downloader",
  path: "/api/download/ytmp3?apikey=&url=&quality=",
  async run(req, res) {
    const { url, apikey, quality } = req.query;

    if (!apikey || !global.apikey.includes(apikey)) {
      return res.status(401).json({ status: false, error: "Apikey invalid atau tidak terdaftar" });
    }
    if (!url) {
      return res.status(400).json({ status: false, error: "Parameter 'url' wajib diisi" });
    }

    const allowedQuality = ["320", "256", "128", "64"];
    const q = allowedQuality.includes(quality) ? quality : "128";

    try {
      const result = await processMedia(url, "audio", q);
      return res.status(200).json({
        status: true,
        result
      });
    } catch (error) {
      return res.status(500).json({
        status: false,
        error: error.message || error
      });
    }
  }
};
