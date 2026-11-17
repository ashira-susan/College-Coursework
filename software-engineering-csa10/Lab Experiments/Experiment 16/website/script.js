function updateClock() {
  var el = document.getElementById("clock");
  if (el) { el.textContent = "Browser time: " + new Date().toLocaleString(); }
}
updateClock();
setInterval(updateClock, 1000);

var btn = document.getElementById("themeBtn");
if (btn) {
  btn.addEventListener("click", function () {
    document.body.classList.toggle("dark");
  });
}
