const RUTA_MODEL = "./model/model.json";
const MIDA_IMATGE = 224;

// Franja orientativa per mostrar un resultat incert
const LLINDAR_INFERIOR = 0.40;
const LLINDAR_SUPERIOR = 0.60;

let model = null;
let imatgePreparada = false;
let urlTemporal = null;

// Elements de la pàgina
const estatModel = document.getElementById("model-status");
const inputImatge = document.getElementById("imatge-input");
const previsualitzacio = document.getElementById("imatge-preview");
const botoAnalitzar = document.getElementById("boto-analitzar");

const resultatBuit = document.getElementById("resultat-buit");
const resultat = document.getElementById("resultat");
const classificacio = document.getElementById("classificacio");
const puntuacio = document.getElementById("puntuacio");
const barraPuntuacio = document.getElementById("barra-puntuacio");
const interpretacio = document.getElementById("interpretacio");

function actualitzarBoto() {
    botoAnalitzar.disabled = !(model && imatgePreparada);
}

async function carregarModel() {
    try {
        estatModel.textContent = "Carregant el model...";
        actualitzarBoto();

        await tf.ready();
        model = await tf.loadLayersModel(RUTA_MODEL);

        // Primera predicció buida per preparar el model
        const entradaProva = tf.zeros([1, MIDA_IMATGE, MIDA_IMATGE, 3]);
        const sortidaProva = model.predict(entradaProva);

        if (Array.isArray(sortidaProva)) {
            sortidaProva.forEach(tensor => tensor.dispose());
        } else {
            sortidaProva.dispose();
        }

        entradaProva.dispose();

        estatModel.textContent = "Model preparat.";
        actualitzarBoto();
    } catch (error) {
        console.error("Error carregant el model:", error);
        estatModel.textContent =
            "No s'ha pogut carregar el model. Torna-ho a provar més tard.";
    }
}

inputImatge.addEventListener("change", () => {
    const fitxer = inputImatge.files[0];

    if (!fitxer) {
        imatgePreparada = false;
        previsualitzacio.hidden = true;
        actualitzarBoto();
        return;
    }

    const nomValid = /\.(jpg|jpeg|png)$/i.test(fitxer.name);
    const tipusValid =
        fitxer.type === "image/jpeg" ||
        fitxer.type === "image/png" ||
        (fitxer.type === "" && nomValid);

    if (!tipusValid) {
        alert("Selecciona una imatge en format JPG, JPEG o PNG.");
        inputImatge.value = "";
        imatgePreparada = false;
        previsualitzacio.hidden = true;
        actualitzarBoto();
        return;
    }

    const midaMaxima = 20 * 1024 * 1024;

    if (fitxer.size > midaMaxima) {
        alert("La imatge és massa gran. La mida màxima és de 20 MB.");
        inputImatge.value = "";
        imatgePreparada = false;
        previsualitzacio.hidden = true;
        actualitzarBoto();
        return;
    }

    imatgePreparada = false;
    actualitzarBoto();

    if (urlTemporal) {
        URL.revokeObjectURL(urlTemporal);
    }

    urlTemporal = URL.createObjectURL(fitxer);

    previsualitzacio.onload = () => {
        imatgePreparada = true;
        previsualitzacio.hidden = false;

        resultat.hidden = true;
        resultatBuit.hidden = false;

        actualitzarBoto();
    };

    previsualitzacio.onerror = () => {
        alert("No s'ha pogut llegir la imatge seleccionada.");
        imatgePreparada = false;
        previsualitzacio.hidden = true;
        actualitzarBoto();
    };

    previsualitzacio.src = urlTemporal;
});

function prepararImatge() {
    return tf.tidy(() => {
        return tf.browser
            .fromPixels(previsualitzacio, 3)
            .resizeBilinear([MIDA_IMATGE, MIDA_IMATGE])
            .toFloat()
            .div(255)
            .expandDims(0);
    });
}

botoAnalitzar.addEventListener("click", async () => {
    if (!model || !imatgePreparada) {
        return;
    }

    botoAnalitzar.disabled = true;
    botoAnalitzar.textContent = "Analitzant...";

    let entrada = null;
    let prediccio = null;

    try {
        entrada = prepararImatge();
        prediccio = model.predict(entrada);

        const tensorSortida = Array.isArray(prediccio)
            ? prediccio[0]
            : prediccio;

        const valors = await tensorSortida.data();
        const probabilitat = Number(valors[0]);

        mostrarResultat(probabilitat);
    } catch (error) {
        console.error("Error durant l'anàlisi:", error);
        alert(
            "S'ha produït un error durant l'anàlisi. Torna-ho a provar."
        );
    } finally {
        if (entrada) {
            entrada.dispose();
        }

        if (prediccio) {
            if (Array.isArray(prediccio)) {
                prediccio.forEach(tensor => tensor.dispose());
            } else {
                prediccio.dispose();
            }
        }

        botoAnalitzar.textContent = "Analitza la radiografia";
        actualitzarBoto();
    }
});

function mostrarResultat(probabilitat) {
    const percentatge = probabilitat * 100;

    puntuacio.textContent =
        percentatge.toLocaleString("ca-ES", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        }) + " %";

    barraPuntuacio.style.width = `${Math.min(percentatge, 100)}%`;

    if (probabilitat >= LLINDAR_SUPERIOR) {
        classificacio.textContent = "PNEUMÒNIA";
        classificacio.style.color = "#b86600";
        barraPuntuacio.style.backgroundColor = "#df922f";

        interpretacio.textContent =
            "El model ha detectat característiques compatibles amb pneumònia. Aquest resultat és orientatiu i no substitueix el diagnòstic d'un professional sanitari.";
    } else if (probabilitat <= LLINDAR_INFERIOR) {
        classificacio.textContent = "NORMAL";
        classificacio.style.color = "#16734a";
        barraPuntuacio.style.backgroundColor = "#2b9b6c";

        interpretacio.textContent =
            "El model no ha detectat característiques clares compatibles amb pneumònia. Aquest resultat és orientatiu i no substitueix el diagnòstic d'un professional sanitari.";
    } else {
        classificacio.textContent = "RESULTAT INCERT";
        classificacio.style.color = "#7a5a00";
        barraPuntuacio.style.backgroundColor = "#d4a72c";

        interpretacio.textContent =
            "No es pot obtenir una classificació prou clara. Aquest resultat no permet confirmar ni descartar la presència de pneumònia. Per obtenir un diagnòstic vàlid, cal consultar un professional sanitari.";
    }

    resultatBuit.hidden = true;
    resultat.hidden = false;
}

actualitzarBoto();
carregarModel();
