// Client-side validation only - a real login needs a server.
var form = document.getElementById("loginForm");
var email = document.getElementById("email");
var password = document.getElementById("password");

function setError(input, errorId, message) {
  document.getElementById(errorId).textContent = message;
  input.classList.toggle("invalid", message !== "");
}

function validateEmail() {
  var ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim());
  setError(email, "emailError", ok ? "" : "Enter a valid email address");
  return ok;
}

function validatePassword() {
  var ok = password.value.length >= 8;
  setError(password, "passwordError", ok ? "" : "Password must be at least 8 characters");
  return ok;
}

document.getElementById("togglePw").addEventListener("click", function () {
  var hidden = password.type === "password";
  password.type = hidden ? "text" : "password";
  this.textContent = hidden ? "Hide" : "Show";
});

form.addEventListener("submit", function (e) {
  e.preventDefault();
  var msg = document.getElementById("formMessage");
  if (validateEmail() & validatePassword()) {
    msg.textContent = "Login successful (demo).";
    msg.className = "ok";
  } else {
    msg.textContent = "";
  }
});
