document.addEventListener("DOMContentLoaded", function() {
  const fetchButton = document.getElementById("fetchButton");
  const downloadButton = document.getElementById("downloadButton");
  const usernameInput = document.getElementById("usernameInput");
  const startDateTimeInput = document.getElementById("startDateTimeInput");
  const endDateTimeInput = document.getElementById("endDateTimeInput");
  const messagesDiv = document.getElementById("messages");
  const progressBar = document.getElementById("progressBar");
  const searchInput = document.getElementById("searchInput");
  const uniqueMessages = new Set();
  const recordedMessages = [];
  let abortController = null; // Initialize the abort controller

  const currentDateTime = formatTimestamp(new Date());
  startDateTimeInput.placeholder = "YYYY-MM-DD HH:MM:SS";
  startDateTimeInput.value = currentDateTime;
  endDateTimeInput.placeholder = "YYYY-MM-DD HH:MM:SS";
  endDateTimeInput.value = currentDateTime;

  fetchButton.addEventListener("click", async function() {
    const selectedUsername = usernameInput.value;
    const usernameApiUrl = `https://kick.com/api/v2/channels/${selectedUsername}`;
    // Exclude BotRix messages by default
    const excludeBotRix = true;

    if (abortController) {
      // If an abort controller is active, cancel the fetch and reset the UI
      abortController.abort();
      abortController = null;
      fetchButton.textContent = "Fetch Messages";
      fetchButton.style.backgroundColor = "#3AA51A"; // Set back to original color
      progressBar.value = 100; // Set progress bar to 100%
      downloadButton.disabled = false;
    } else {
      // If no abort controller is active, start fetching messages
      abortController = new AbortController();
      fetchButton.textContent = "Abort";
      fetchButton.style.backgroundColor = "red"; // Change button color to red

      try {
        // Disable the download button at the start of a new fetch lookup
        downloadButton.disabled = true;

        const response = await fetch(usernameApiUrl, { signal: abortController.signal });
        const userData = await response.json();
        const channelId = userData.id;

        messagesDiv.innerHTML = "";
        uniqueMessages.clear();
        recordedMessages.length = 0; // Clear recorded messages
        progressBar.value = 0;

        const startDateTime = new Date(startDateTimeInput.value);
        const endDateTime = new Date(endDateTimeInput.value);

        let currentTime = new Date(startDateTime);

        while (currentTime <= endDateTime) {
          const startTimeISO = currentTime.toISOString();
          const messagesApiUrl = `https://kick.com/api/v2/channels/${channelId}/messages?start_time=${encodeURIComponent(startTimeISO)}`;

          try {
            const messagesResponse = await fetch(messagesApiUrl, { signal: abortController.signal });
            const messagesData = await messagesResponse.json();

            messagesData.data.messages.forEach(async message => {
              let messageText = message.content;
              const messageTimestamp = message.created_at;
              const senderUsername = message.sender.username;

              messageText = messageText.replace(/\[emote:(\d+:[A-Za-z0-9]*|:\d+[A-Za-z0-9]*)\]/g, (match, emoteId) => {
                if (emoteId) {
                  const emoteParts = emoteId.split(":");
                  const emoteNumber = emoteParts[0];
                  return `<img src="https://files.kick.com/emotes/${emoteNumber}/fullsize" alt="${emoteNumber}" width="28" height="28" />`;
                } else {
                  return match;
                }
              });

              if (!uniqueMessages.has(messageText) && (!excludeBotRix || senderUsername !== "BotRix")) {
                uniqueMessages.add(messageText);
                recordedMessages.unshift(`${senderUsername} @ ${formatTimestamp(messageTimestamp)}\n${messageText}\n\n`);

                const messageDiv = document.createElement("div");
                messageDiv.classList.add("message");

                const messageContent = document.createElement("p");
                messageContent.innerHTML = messageText;

                const messageInfo = document.createElement("small");
                messageInfo.innerHTML = `<strong>${senderUsername}</strong> @ ${formatTimestamp(messageTimestamp)}`;

                messageDiv.appendChild(messageContent);
                messageDiv.appendChild(messageInfo);
                messagesDiv.insertBefore(messageDiv, messagesDiv.firstChild);
              }
            });
          } catch (error) {
            progressBar.value = 100;
            console.error("Error fetching messages:", error);
            //messagesDiv.innerHTML = "Error fetching messages.";
          }

          currentTime = new Date(currentTime.getTime() + 1000); // Increment by 1 second
          await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay

          const progress = ((currentTime - startDateTime) / (endDateTime - startDateTime)) * 100;
          progressBar.value = progress;
        }

        if (recordedMessages.length > 0) {
          downloadButton.disabled = false;
        }
      } catch (error) {
        progressBar.value = 100;
        console.error("Error fetching user data:", error);
        //messagesDiv.innerHTML = "Error fetching user data.";
      } finally {
        // Reset the UI and abort controller when fetching is complete
        abortController = null;
        fetchButton.textContent = "Fetch";
        fetchButton.style.backgroundColor = "#3AA51A"; // Set back to original color
      }
    }
  });

  downloadButton.addEventListener("click", function() {
    const searchTerm = searchInput.value.toLowerCase();

    const filteredMessagesText = Array.from(messagesDiv.querySelectorAll(".message"))
      .filter(messageElement => {
        const messageText = messageElement.querySelector("p").textContent.toLowerCase();
        const messageInfo = messageElement.querySelector("small").textContent.toLowerCase();
        return messageText.includes(searchTerm) || messageInfo.includes(searchTerm);
      })
      .map(messageElement => {
        const messageText = messageElement.querySelector("p").textContent;
        const messageInfo = messageElement.querySelector("small").textContent;
        return `${messageInfo}\n${messageText}\n\n`;
      })
      .join('');

    const blob = new Blob([filteredMessagesText], { type: 'text/plain' });
    const downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = 'messages.txt';
    downloadLink.click();
  });

  searchInput.addEventListener("input", function() {
    const searchTerm = searchInput.value.toLowerCase();
    const messageElements = messagesDiv.querySelectorAll(".message");

    messageElements.forEach(messageElement => {
      const messageText = messageElement.querySelector("p").textContent.toLowerCase();
      const messageInfo = messageElement.querySelector("small").textContent.toLowerCase();
      if (messageText.includes(searchTerm) || messageInfo.includes(searchTerm)) {
        messageElement.style.display = "block";
      } else {
        messageElement.style.display = "none";
      }
    });
  });

  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    const hours = ('0' + date.getHours()).slice(-2);
    const minutes = ('0' + date.getMinutes()).slice(-2);
    const seconds = ('0' + date.getSeconds()).slice(-2);
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
});