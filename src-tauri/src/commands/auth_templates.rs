pub const fn failure_html() -> &'static str {
    r###"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Roblox Login Failed</title>
<style>
  body {
    margin: 0;
    padding: 0;
    background-color: #000000;
    color: #f4f4f5;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    overflow: hidden;
    position: relative;
  }


  .content {
    position: relative;
    z-index: 10;
    text-align: center;
    max-width: 440px;
    width: 90%;
    pointer-events: none;
    animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    opacity: 0;
    transform: translateY(20px);
  }
  @keyframes fadeIn {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  h1 {
    margin: 0 0 16px 0;
    font-size: 32px;
    font-weight: 800;
    letter-spacing: -0.025em;
    color: #ffffff;
    text-shadow: 0 4px 16px rgba(0,0,0,0.9);
  }
  p {
    margin: 0;
    font-size: 16px;
    color: #d4d4d8;
    line-height: 1.6;
    transition: opacity 0.25s ease;
    text-shadow: 0 2px 10px rgba(0,0,0,0.9);
  }
  kbd {
    background: #27272a;
    padding: 3px 8px;
    border-radius: 5px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 700;
    border: 1px solid #3f3f46;
    color: #ffffff;
    box-shadow: 0 2px 0 #18181b;
  }
</style>
</head>
<body>

<div class="content">
  <h1>Login Failed</h1>
  <p id="status-msg">The authentication process was cancelled or failed. Please return to ISpooferMotion and try again.</p>
</div>
<script>
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const shortcut = isMac ? '⌘ + W' : 'Ctrl + W';

  function closeWindow() {
    window.close();
    setTimeout(() => {
      const msg = document.getElementById('status-msg');
      msg.style.opacity = '0';
      setTimeout(() => {
        msg.innerHTML = `Browser security prevents automatic closing. <br>Please press <kbd>${shortcut}</kbd> or close the tab manually.`;
        msg.style.opacity = '1';
      }, 150);
    }, 100);
  }

  setTimeout(closeWindow, 2000);
</script>
</body>
</html>"###
}

pub const fn success_html() -> &'static str {
    r###"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Roblox Login Complete</title>
<style>
  body {
    margin: 0;
    padding: 0;
    background-color: #000000;
    color: #f4f4f5;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    overflow: hidden;
    position: relative;
  }


  .content {
    position: relative;
    z-index: 10;
    text-align: center;
    max-width: 440px;
    width: 90%;
    pointer-events: none;
    animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    opacity: 0;
    transform: translateY(20px);
  }
  @keyframes fadeIn {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  h1 {
    margin: 0 0 16px 0;
    font-size: 32px;
    font-weight: 800;
    letter-spacing: -0.025em;
    color: #ffffff;
    text-shadow: 0 4px 16px rgba(0,0,0,0.9);
  }
  p {
    margin: 0;
    font-size: 16px;
    color: #d4d4d8;
    line-height: 1.6;
    transition: opacity 0.25s ease;
    text-shadow: 0 2px 10px rgba(0,0,0,0.9);
  }
  kbd {
    background: #27272a;
    padding: 3px 8px;
    border-radius: 5px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 700;
    border: 1px solid #3f3f46;
    color: #ffffff;
    box-shadow: 0 2px 0 #18181b;
  }
</style>
</head>
<body>

<div class="content">
  <h1>Login Complete!</h1>
  <p id="status-msg">You have successfully connected your Roblox account to ISpooferMotion. You can now close this tab.</p>
</div>
<script>
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const shortcut = isMac ? '⌘ + W' : 'Ctrl + W';

  function closeWindow() {
    window.close();
    setTimeout(() => {
      const msg = document.getElementById('status-msg');
      msg.style.opacity = '0';
      setTimeout(() => {
        msg.innerHTML = `Browser security prevents automatic closing. <br>Please press <kbd>${shortcut}</kbd> or close the tab manually.`;
        msg.style.opacity = '1';
      }, 150);
    }, 100);
  }

  setTimeout(closeWindow, 1500);
</script>
</body>
</html>"###
}
