window.onload = async () => {
  const MODEL_URL = chrome.runtime.getURL("models/");
  await faceapi.loadSsdMobilenetv1Model(MODEL_URL);
  await faceapi.loadFaceExpressionModel(MODEL_URL);

  // Map to store the canvas, table, and observers associated with each video element
  const videoMap = new Map();

  let lastDetectionTime = Date.now();

  // Function to update the canvas size and position and draw video onto canvas
  const updateCanvas = async (canvas, video, table) => {
    let expressionsData = {
      angry: 0,
      disgusted: 0,
      fearful: 0,
      happy: 0,
      neutral: 0,
      sad: 0,
      surprised: 0,
    };
    const rect = video.getBoundingClientRect();

    // If the video has been sized and positioned
    if (rect.width > 0 && rect.height > 0) {
      // Position the canvas over the video
      canvas.width = rect.width;
      canvas.height = rect.height;
      canvas.style.position = "absolute";
      canvas.style.left = rect.left + "px";
      canvas.style.top = rect.top + "px";
      // Draw video onto canvas
      canvas
        .getContext("2d", { willReadFrequently: true })
        .drawImage(video, 0, 0, rect.width, rect.height);

      // Position and style the table
      table.style.position = "absolute";
      table.style.left = rect.left + "px";
      table.style.top = rect.top + rect.height - table.offsetHeight + "px";
      table.style.zIndex = "101";
      table.style.border = "1px solid black";
      table.style.backgroundColor = "rgba(255, 255, 255, 0.35)";
      table.style.padding = "10px";
      table.style.borderRadius = "5px";
    }

    if (Date.now() - lastDetectionTime > 100) {
      lastDetectionTime = Date.now();
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(video, 0, 0, rect.width, rect.height);

      if (rect.width > 0 && rect.height > 0) {
        const detections = await faceapi
          .detectAllFaces(canvas, new faceapi.SsdMobilenetv1Options())
          .withFaceExpressions();

        if (detections.length > 0) {
          expressionsData = detections.reduce((acc, detection, idx) => {
            const { expressions } = detection;
            return {
              angry: (
                (acc.angry * idx + parseFloat(expressions.angry.toFixed(3))) /
                (idx + 1)
              ).toFixed(3),
              disgusted: (
                (acc.disgusted * idx +
                  parseFloat(expressions.disgusted.toFixed(3))) /
                (idx + 1)
              ).toFixed(3),
              fearful: (
                (acc.fearful * idx +
                  parseFloat(expressions.fearful.toFixed(3))) /
                (idx + 1)
              ).toFixed(3),
              happy: (
                (acc.happy * idx + parseFloat(expressions.happy.toFixed(3))) /
                (idx + 1)
              ).toFixed(3),
              neutral: (
                (acc.neutral * idx +
                  parseFloat(expressions.neutral.toFixed(3))) /
                (idx + 1)
              ).toFixed(3),
              sad: (
                (acc.sad * idx + parseFloat(expressions.sad.toFixed(3))) /
                (idx + 1)
              ).toFixed(3),
              surprised: (
                (acc.surprised * idx +
                  parseFloat(expressions.surprised.toFixed(3))) /
                (idx + 1)
              ).toFixed(3),
            };
          }, expressionsData);

          let html = "<table>";
          for (let key in expressionsData) {
            html += `<tr><td>${key}</td><td>${expressionsData[key]}</td></tr>`;
          }
          html += "</table>";
          table.innerHTML = html;
        }
      }
    }

    requestAnimationFrame(function () {
      updateCanvas(canvas, video, table);
    });
  };

  // Create a new IntersectionObserver instance
  const intersectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      // Get the canvas and observers from the map
      const data = videoMap.get(entry.target);

      if (data) {
        // If the video element is not in the viewport or not visible
        if (!entry.isIntersecting) {
          console.log("removing canvas");
          // Remove the canvas and table from the body
          if (data.canvas.parentNode) {
            data.canvas.parentNode.removeChild(data.canvas);
            data.table.parentNode.removeChild(data.table); // Remove the table
          }
        } else {
          // Add the canvas and table to the body
          if (!data.canvas.parentNode) {
            document.body.appendChild(data.canvas);
            document.body.appendChild(data.table); // Add the table
          }
        }
      }
    });
  });

  const observeDocument = (document) => {
    // Create a new MutationObserver instance
    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        // If new nodes are added
        if (mutation.addedNodes) {
          mutation.addedNodes.forEach(function (node) {
            // If the new node is a video element
            if (node.nodeName.toLowerCase() === "video") {
              console.log("creating canvas");
              // Create a new canvas element
              const canvas = document.createElement("canvas");

              // Create a table for the expressions data
              const table = document.createElement("div");
              table.id = "table" + Math.random().toString(36).substring(2); // Set a unique id for each table
              document.body.appendChild(table); // Add the table to the document body immediately after creation

              // Create a new ResizeObserver instance
              const resizeObserver = new ResizeObserver(function () {
                updateCanvas(canvas, node, table);
              });

              // Start observing the video element for resize events
              resizeObserver.observe(node);

              // Create a new MutationObserver instance
              const mutationObserver = new MutationObserver(function () {
                updateCanvas(canvas, node, table);
              });

              // Start observing the video element for attribute changes
              mutationObserver.observe(node, { attributes: true });

              // Store the canvas, table, and observers in the map
              videoMap.set(node, {
                canvas: canvas,
                table: table,
                resizeObserver: resizeObserver,
                mutationObserver: mutationObserver,
              });

              // Start observing the video element for intersection changes
              intersectionObserver.observe(node);
            }
            // If the new node is an iframe element
            if (node.nodeName.toLowerCase() === "iframe") {
              // Try to access the iframe's document and observe it
              try {
                const iframeDoc = node.contentWindow.document;
                observeDocument(iframeDoc);
              } catch (error) {
                console.error("Unable to access iframe's document:", error);
              }
            }
          });
        }

        // If nodes are removed
        if (mutation.removedNodes) {
          mutation.removedNodes.forEach(function (node) {
            // If the removed node is a video element
            if (node.nodeName.toLowerCase() === "video") {
              // Get the canvas, table, and observers from the map
              const data = videoMap.get(node);

              if (data) {
                console.log("removing canvas");
                // Remove the canvas and table from the body
                if (data.canvas.parentNode) {
                  data.canvas.parentNode.removeChild(data.canvas);
                  const table = document.getElementById(data.table.id);
                  if (table) {
                    table.parentNode.removeChild(table);
                  }
                }

                // Disconnect the observers
                data.resizeObserver.disconnect();
                data.mutationObserver.disconnect();

                // Stop observing the video element for intersection changes
                intersectionObserver.unobserve(node);

                // Remove the data from the map
                videoMap.delete(node);
              }
            }
          });
        }
      });
    });

    // Start observing the document with the configured parameters
    observer.observe(document, { childList: true, subtree: true });
  };
  // Start observing the main document
  observeDocument(document);
};
