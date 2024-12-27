const TelegramBot = require('node-telegram-bot-api');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Replace with your own bot token from BotFather
const token = '8183335872:AAHxom0APQ1ervG8uk3APVE8aSc-ERqY6Zw';

// Replace with your channel's chat ID or username
const logChannelId = '@testing_xyz';

const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Welcome! Send me a YouTube link to download the video or audio.');
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Check if the message is a valid URL (basic check)
  if (text.startsWith('http')) {
    bot.sendMessage(chatId, 'Downloading...');
    bot.sendMessage(logChannelId, `User ${msg.from.username || msg.from.id} requested download: ${text}`);

    // Define output path
    const outputPath = path.join(__dirname, '%(title)s.%(ext)s');

    // Execute yt-dlp command
    exec(`yt-dlp ${text} -f bestvideo+bestaudio -o "${outputPath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        bot.sendMessage(chatId, 'Failed to download the video.');
        bot.sendMessage(logChannelId, `Download failed for ${text}: ${error.message}`);
        return;
      }
      console.log(`stdout: ${stdout}`);
      console.error(`stderr: ${stderr}`);
      bot.sendMessage(logChannelId, `Download completed for ${text}`);

      // Find the downloaded file
      const matches = stdout.match(/(?<=\[download\] Destination: ).+/);
      if (matches) {
        const filePath = matches[0].trim();
        const fileName = path.basename(filePath);
        const mp4FileName = path.basename(fileName, path.extname(fileName)) + '.mp4';
        const mp4FilePath = path.join(__dirname, mp4FileName);

        // Convert to MP4 using ffmpeg if necessary
        if (path.extname(filePath) !== '.mp4') {
          exec(`ffmpeg -i "${filePath}" -c:v copy -c:a aac "${mp4FilePath}"`, (ffmpegError, ffmpegStdout, ffmpegStderr) => {
            if (ffmpegError) {
              console.error(`ffmpeg exec error: ${ffmpegError}`);
              bot.sendMessage(chatId, 'Failed to convert video to MP4.');
              bot.sendMessage(logChannelId, `Conversion failed for ${fileName}: ${ffmpegError.message}`);
              return;
            }

            // Send the MP4 file
            bot.sendDocument(chatId, fs.createReadStream(mp4FilePath))
              .then(() => {
                fs.unlinkSync(filePath); // Delete the original file
                fs.unlinkSync(mp4FilePath); // Delete the MP4 file after sending
                bot.sendMessage(logChannelId, `File sent to user ${msg.from.username || msg.from.id}: ${mp4FileName}`);
              })
              .catch(err => {
                console.error('Error sending file:', err);
                bot.sendMessage(chatId, 'Error sending the file.');
                bot.sendMessage(logChannelId, `Error sending file ${mp4FileName}: ${err.message}`);
              });
          });
        } else {
          // If already MP4, send it directly
          bot.sendDocument(chatId, fs.createReadStream(filePath))
            .then(() => {
              fs.unlinkSync(filePath); // Delete the file after sending
              bot.sendMessage(logChannelId, `File sent to user ${msg.from.username || msg.from.id}: ${fileName}`);
            })
            .catch(err => {
              console.error('Error sending file:', err);
              bot.sendMessage(chatId, 'Error sending the file.');
              bot.sendMessage(logChannelId, `Error sending file ${fileName}: ${err.message}`);
            });
        }
      } else {
        bot.sendMessage(chatId, 'Could not find the downloaded file.');
        bot.sendMessage(logChannelId, `Download completed but file not found for ${text}`);
      }
    });
  }
});
