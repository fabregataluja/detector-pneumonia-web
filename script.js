// CONFIGURACIÓ DEL MODEL

const RUTA_MODEL = "./model/model.json";
const MIDA_IMATGE = 224;
const LLINDAR = 0.4836;

let model = null;


// ELEMENTS DE LA PÀGINA

const estatModel = document.getElementById("model-status");
const inputImatge = document.getElementById("imatge-input");
const imatgePreview = document.getElementById("imatge-preview");
const botoAnalitzar = document.getElementById("boto-analitzar");

const resultatBuit = document.getElementById("resultat-buit");
const resultat = document.getElementById("resultat");
const classificacio = document.getElementById("classificacio");
const puntuacio = document.getElementById("puntuacio");
const barraPuntuacio = document.getElementById("barra-puntuacio");
const interpretacio = document.getElementById("interpretacio");


// CARREGAR EL MODEL

async function carregarModel() {
  try {
    estatModel.textContent = "Carregant el model...";

    await tf.ready();

    model = await tf.loadLayersModel(RUTA_MODEL);

    // Petita prova perquè el model quedi preparat
    const prova = tf.zeros([
      1,
      MIDA_IMATGE,
      MIDA_IMATGE,
      3
    ]);

    const resultatProva = model.predict(prova);

    await resultatProva.data();

    prova.dispose();
    resultatProva.dispose();

    estatModel.textContent = "Model preparat";

    if (!imatgePreview.hidden) {
      botoAnalitzar.disabled = false;
    }

  } catch (error) {
    console.error(error);

    estatModel.textContent =
      "No s'ha pogut carregar el model";
  }
}


// SELECCIONAR UNA RADIOGRAFIA

inputImatge.addEventListener("change", function () {
  const fitxer = inputImatge.files[0];

  if (!fitxer) {
    return;
  }

  const formatsPermesos = [
    "image/jpeg",
    "image/png"
  ];

  if (!formatsPermesos.includes(fitxer.type)) {
    alert("Selecciona una imatge en format JPG o PNG.");
    inputImatge.value = "";
    return;
  }

  const midaMaxima = 20 * 1024 * 1024;

  if (fitxer.size > midaMaxima) {
    alert("La imatge no pot superar els 20 MB.");
    inputImatge.value = "";
    return;
  }

  const lector = new FileReader();

  lector.onload = function (event) {
    imatgePreview.src = event.target.result;
    imatgePreview.hidden = false;

    resultat.hidden = true;
    resultatBuit.hidden = false;

    imatgePreview.onload = function () {
      if (model) {
        botoAnalitzar.disabled = false;
      }
    };
  };

  lector.readAsDataURL(fitxer);
});


// PREPARAR LA IMATGE

function prepararImatge() {
  return tf.tidy(function () {
    return tf.browser
      .fromPixels(imatgePreview, 3)
      .resizeBilinear([
        MIDA_IMATGE,
        MIDA_IMATGE
      ])
      .toFloat()
      .div(255)
      .expandDims(0);
  });
}


// ANALITZAR LA RADIOGRAFIA

botoAnalitzar.addEventListener("click", async function () {
  if (!model || imatgePreview.hidden) {
    return;
  }

  botoAnalitzar.disabled = true;
  botoAnalitzar.textContent = "Analitzant...";

  try {
    const tensorImatge = prepararImatge();

    const prediccio = model.predict(tensorImatge);

    const dades = await prediccio.data();

    const valor = dades[0];

    tensorImatge.dispose();
    prediccio.dispose();

    mostrarResultat(valor);

  } catch (error) {
    console.error(error);

    alert(
      "S'ha produït un error durant l'anàlisi."
    );

  } finally {
    botoAnalitzar.disabled = false;
    botoAnalitzar.textContent =
      "Analitza la radiografia";
  }
});


// MOSTRAR EL RESULTAT

function mostrarResultat(valor) {
  const percentatge = valor * 100;

  resultatBuit.hidden = true;
  resultat.hidden = false;

  puntuacio.textContent =
    percentatge.toFixed(1).replace(".", ",") + " %";

  barraPuntuacio.style.width =
    percentatge + "%";

  if (valor >= LLINDAR) {
    classificacio.textContent = "PNEUMÒNIA";
    classificacio.style.color = "#b36a1c";
    barraPuntuacio.style.backgroundColor = "#d58a35";

    interpretacio.textContent =
      "El model ha detectat característiques compatibles " +
      "amb pneumònia.";

  } else {
    classificacio.textContent = "NORMAL";
    classificacio.style.color = "#278267";
    barraPuntuacio.style.backgroundColor = "#278267";

    interpretacio.textContent =
      "El model ha classificat la radiografia com a normal.";
  }
}


// INICIAR LA CÀRREGA

carregarModel();
