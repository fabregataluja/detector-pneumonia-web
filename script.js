const RUTA_MODEL = "./model/model.json";
const MIDA_IMATGE = 224;

// Zona experimental d'incertesa definida a partir del conjunt de validació.
// No és un interval de confiança clínic.
const LLINDAR_NORMAL = 0.053;
const LLINDAR_PNEUMONIA = 0.813;

let model = null;
let imatgePreparada = false;
let urlTemporal = null;

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

        // Predicció buida per inicialitzar el model al navegador.
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
        // El model web conserva la mateixa transformació que el model final:
        // píxels [0,255] -> [0,1] aquí, i després x*2-1 dins del model.
        return tf.browser
            .fromPixels(previsualitzacio, 3)
            .resizeBilinear([MIDA_IMATGE, MIDA_IMATGE])
            .toFloat()
            .div(255)
            .expandDims(0);
    });
}

botoAnalitzar.addEventListener("click", async () => {
    if (!model || !imatgePreparada) return;

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
        const score = Number(valors[0]);

        mostrarResultat(score);
    } catch (error) {
        console.error("Error durant l'anàlisi:", error);
        alert("S'ha produït un error durant l'anàlisi. Torna-ho a provar.");
    } finally {
        if (entrada) entrada.dispose();

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

function mostrarResultat(score) {
    const percentatge = score * 100;

    puntuacio.textContent =
        percentatge.toLocaleString("ca-ES", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        }) + " / 100";

    barraPuntuacio.style.width = `${Math.min(percentatge, 100)}%`;

    if (score < LLINDAR_NORMAL) {
        classificacio.textContent = "NORMAL";
        classificacio.className = "resultat-normal";
        barraPuntuacio.className = "barra-normal";

        interpretacio.textContent =
            "La puntuació del model queda dins la zona classificada com a normal. És un resultat experimental i no substitueix la valoració d'un professional sanitari.";
    } else if (score >= LLINDAR_PNEUMONIA) {
        classificacio.textContent = "PNEUMÒNIA";
        classificacio.className = "resultat-pneumonia";
        barraPuntuacio.className = "barra-pneumonia";

        interpretacio.textContent =
            "El model ha detectat patrons que associa amb pneumònia. La puntuació no és una probabilitat clínica ni constitueix un diagnòstic.";
    } else {
        classificacio.textContent = "RESULTAT INCERT";
        classificacio.className = "resultat-incert";
        barraPuntuacio.className = "barra-incert";

        interpretacio.textContent =
            "La puntuació queda dins la zona experimental d'incertesa definida durant la validació. El model no dona una classificació prou clara.";
    }

    resultatBuit.hidden = true;
    resultat.hidden = false;
}

actualitzarBoto();
carregarModel();
