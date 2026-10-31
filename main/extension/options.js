// HaYTooL Extension Options Script
const inpPort = document.getElementById('inp-port');
const langCards = document.querySelectorAll('.lang-card');
const btnSave = document.getElementById('btn-save');
const saveToast = document.getElementById('save-toast');

let selectedLang = 'tr';

// Mevcut ayarları yükle
chrome.storage.sync.get(['haytoolPort', 'haytoolLang'], (data) => {
  if (data.haytoolPort) {
    inpPort.value = data.haytoolPort;
  }
  if (data.haytoolLang) {
    selectedLang = data.haytoolLang;
  }
  updateSelectedLangCard();
});

langCards.forEach(card => {
  card.addEventListener('click', () => {
    selectedLang = card.getAttribute('data-lang');
    updateSelectedLangCard();
  });
});

function updateSelectedLangCard() {
  langCards.forEach(card => {
    if (card.getAttribute('data-lang') === selectedLang) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });
}

btnSave.addEventListener('click', () => {
  const port = parseInt(inpPort.value, 10) || 4141;
  chrome.storage.sync.set({
    haytoolPort: port,
    haytoolLang: selectedLang
  }, () => {
    saveToast.style.display = 'block';
    setTimeout(() => {
      saveToast.style.display = 'none';
    }, 2500);
  });
});
