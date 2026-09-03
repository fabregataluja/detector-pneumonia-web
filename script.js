// =====================================================
// CONFIGURACIÓ DEL MODEL
// =====================================================

// Carpeta on es troben model.json i els fitxers .bin
const RUTA_MODEL = "./model/model.json";

// Mida d'entrada utilitzada durant l'entrenament
const MIDA_IMATGE = 224;

// Llindar binari calculat amb el conjunt de validació
const LLINDAR_ORIGINAL = 0.4836;

// Franja orientativa utilitzada a la web per evitar
// presentar els resultats fronterers com a segurs
const LLINDAR_INFERIOR = 0.40;
const LLINDAR_SUPERIOR = 0.60;

let model = null;


// =====================================================
// ELEMENTS DE LA PÀGINA
// =====================================================

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


// =====================================================
// CARREGAR EL MODEL
// =====================================================

async function carregarModel() {
  estatModel.textContent = "Carregant el model...";

  try {
    // Espera que TensorFlow.js estigui preparat
    await tf.ready();

    // Carrega l'arquitectura i els pesos del model
    model = await tf.loadLayersModel(RUTA_MODEL);

    // Fa una predicció buida per preparar el model
    const tensorProva = tf.zeros([
      1,
      MIDA_IMATGE,
      MIDA_IMATGE,
      3
    ]);

    const prediccioProva = model.predict(tensorProva);

    await prediccioProva.data();

    tensorProva.dispose();
    prediccioProva.dispose();

    estatModel.textContent = "Model preparat";

    // Activa el botó si ja s'ha seleccionat una imatge
    if (!imatgePreview.hidden) {
      botoAnalitzar.disabled = false;
    }

  } catch (error) {
    console.error(
      "Error durant la càrrega del model:",
      error
    );

    estatModel.textContent =
      "No s'ha pogut carregar el model";

    botoAnalitzar.disabled = true;
  }
}


// =====================================================
// SELECCIONAR UNA RADIOGRAFIA
// =====================================================

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
    alert(
      "Selecciona una imatge en format JPG, JPEG o PNG."
    );

    inputImatge.value = "";
    return;
  }

  const midaMaxima = 20 * 1024 * 1024;

  if (fitxer.size > midaMaxima) {
    alert(
      "La imatge no pot superar els 20 MB."
    );

    inputImatge.value = "";
    return;
  }

  // Desactiva temporalment el botó
  botoAnalitzar.disabled = true;

  // Amaga qualsevol resultat anterior
  resultat.hidden = true;
  resultatBuit.hidden = false;

  classificacio.textContent = "";
  puntuacio.textContent = "";
  interpretacio.textContent = "";
  barraPuntuacio.style.width = "0%";

  const lector = new FileReader();

  lector.onload = function (event) {
    imatgePreview.onload = function () {
      imatgePreview.hidden = false;

      if (model) {
        botoAnalitzar.disabled = false;
      }
    };

    imatgePreview.src = event.target.result;
  };

  lector.onerror = function () {
    alert(
      "No s'ha pogut llegir la imatge seleccionada."
    );
  };

  lector.readAsDataURL(fitxer);
});


// =====================================================
// PREPARAR LA IMATGE
// =====================================================

function prepararImatge() {
  return tf.tidy(function () {
    return tf.browser
      .fromPixels(imatgePreview, 3)

      // Redimensiona la radiografia a 224 × 224
      .resizeBilinear([
        MIDA_IMATGE,
        MIDA_IMATGE
      ])

      // Converteix els píxels a nombres decimals
      .toFloat()

      // Normalitza els píxels entre 0 i 1
      .div(255)

      // Afegeix la dimensió corresponent al lot
      .expandDims(0);
  });
}


// =====================================================
// ANALITZAR LA RADIOGRAFIA
// =====================================================

botoAnalitzar.addEventListener(
  "click",
  async function () {
    if (!model || imatgePreview.hidden) {
      return;
    }

    botoAnalitzar.disabled = true;
    botoAnalitzar.textContent =
      "Analitzant la radiografia...";

    let tensorImatge = null;
    let prediccio = null;

    try {
      // Prepara la radiografia
      tensorImatge = prepararImatge();

      // Executa el model
      prediccio = model.predict(tensorImatge);

      // Obté la puntuació generada
      const dades = await prediccio.data();

      const valor = Math.min(
        1,
        Math.max(0, Number(dades[0]))
      );

      if (!Number.isFinite(valor)) {
        throw new Error(
          "La puntuació obtinguda no és vàlida."
        );
      }

      mostrarResultat(valor);

    } catch (error) {
      console.error(
        "Error durant l'anàlisi:",
        error
      );

      alert(
        "S'ha produït un error durant l'anàlisi. " +
        "Prova-ho amb una altra imatge."
      );

    } finally {
      // Allibera la memòria utilitzada
      if (tensorImatge) {
        tensorImatge.dispose();
      }

      if (prediccio) {
        prediccio.dispose();
      }

      botoAnalitzar.disabled = false;
      botoAnalitzar.textContent =
        "Analitza la radiografia";
    }
  }
);


// =====================================================
// MOSTRAR EL RESULTAT
// =====================================================

function mostrarResultat(valor) {
  const percentatge = valor * 100;

  resultatBuit.hidden = true;
  resultat.hidden = false;

  puntuacio.textContent =
    percentatge.toFixed(1).replace(".", ",") + " %";

  barraPuntuacio.style.width =
    percentatge + "%";

  // Resultat compatible amb pneumònia
  if (valor >= LLINDAR_SUPERIOR) {
    classificacio.textContent = "PNEUMÒNIA";

    classificacio.style.color = "#b36a1c";

    barraPuntuacio.style.backgroundColor =
      "#d58a35";

    interpretacio.textContent =
      "El model ha detectat característiques " +
      "compatibles amb pneumònia.";

  // Resultat classificat com a normal
  } else if (valor <= LLINDAR_INFERIOR) {
    classificacio.textContent = "NORMAL";

    classificacio.style.color = "#278267";

    barraPuntuacio.style.backgroundColor =
      "#278267";

    interpretacio.textContent =
      "El model ha classificat la radiografia " +
      "com a normal.";

  // Resultat situat a prop del llindar
 } else {
  classificacio.textContent =
    "RESULTAT INCERT";

  classificacio.style.color = "#8a6d1d";

  barraPuntuacio.style.backgroundColor =
    "#d6aa35";

  interpretacio.textContent =
    "No es pot obtenir una classificació prou clara. " +
    "Aquest resultat no permet confirmar ni descartar " +
    "la presència de pneumònia. Per obtenir un diagnòstic " +
    "vàlid, cal consultar un professional sanitari.";
}

// =====================================================
// INICIAR L'APLICACIÓ
// =====================================================

carregarModel();
