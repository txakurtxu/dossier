function uuid() {
    if (crypto.randomUUID) {
        return crypto.randomUUID();
    }

    if (crypto.getRandomValues) {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);

        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;

        const hex = [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");

        return (
            hex.slice(0, 8) + "-" +
            hex.slice(8, 12) + "-" +
            hex.slice(12, 16) + "-" +
            hex.slice(16, 20) + "-" +
            hex.slice(20)
        );
    }

    console.warn("Crypto seguro no disponible, usando UUID de respaldo debil");

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === "x" ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

async function saveJSON(data, defaultFileName) {
    const json = JSON.stringify(data, null, 2);

    if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
            suggestedName: defaultFileName,
            types: [{
                description: "EHR Patient File",
                accept: { "application/json": [".json"] }
            }]
        });

        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
    } else {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = defaultFileName;
        a.click();

        URL.revokeObjectURL(url);
    }
}

function loadPatientFile(event) {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = () => {
        let data;
        try {
            data = JSON.parse(reader.result);
        } catch {
            alert("Archivo JSON inválido");
            return;
        }

        if (data.schema !== "patient-v1") {
            alert("Éste no es un archivo de paciente válido");
            return;
        }

        window.loadedPatientData = data;

        document.getElementById("phi_name").value = data.first_name;
        document.getElementById("phi_lastname").value = data.last_name;
        document.getElementById("phi_birthdate").value = data.birthdate;
        document.getElementById("phi_pid").value = data.personal_id;

        renderVisitHistory();

        document.getElementById("new_notes").value = "";

        showToast("¡Archivo de paciente cargado!");
    };

    reader.readAsText(file);
}

function renderVisitHistory() {
    const historyBox = document.getElementById("history");
    const patient = window.loadedPatientData;

    if (!patient || !patient.visits) {
        historyBox.value = "";
        return;
    }

    const sorted = [...patient.visits].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );

    let text = "";
    for (const v of sorted) {
        const date = v.timestamp.split("T")[0];
        const notes = v.content.notes || "";
        text += `${date}:\n${notes}\n\n`;
    }

    historyBox.value = text.trim();
}

async function saveNewVisit() {
    const firstName = document.getElementById("phi_name").value.trim();
    const lastName  = document.getElementById("phi_lastname").value.trim();
    const birthdate = document.getElementById("phi_birthdate").value;
    const pid       = document.getElementById("phi_pid").value.trim();
    const newNotes  = document.getElementById("new_notes").value.trim();

    if (!firstName || !lastName || !birthdate || !pid) {
        alert("Por favor, complete toda la información del paciente antes de grabar");
        return;
    }

    if (!newNotes) {
        alert("Por favor, ingrese los datos de la visita antes de grabar");
        return;
    }

    let patient = window.loadedPatientData || {
        schema: "patient-v1",
        patient_id: uuid(),
        first_name: firstName,
        last_name: lastName,
        birthdate: birthdate,
        personal_id: pid,
        visits: []
    };

    patient.first_name = firstName;
    patient.last_name = lastName;
    patient.birthdate = birthdate;
    patient.personal_id = pid;

    patient.visits.push({
        visit_id: uuid(),
        timestamp: new Date().toISOString(),
        content: { notes: newNotes }
    });

    const safeLast = lastName.replace(/\s+/g, "_").toUpperCase();
    const safeFirst = firstName.replace(/\s+/g, "_").toUpperCase();
    const safePID = pid.replace(/[^A-Za-z0-9_-]/g, "");
    const filename = `${safeLast}_${safeFirst}_${safePID}.json`;

    await saveJSON(patient, filename);
    window.loadedPatientData = patient;

    renderVisitHistory();

    document.getElementById("new_notes").value = "";

    document.getElementById("patient_file").value = "";

    showToast("¡Visita grabada!");
}

function clearAllFields() {
    document.getElementById("phi_name").value = "";
    document.getElementById("phi_lastname").value = "";
    document.getElementById("phi_birthdate").value = "";
    document.getElementById("phi_pid").value = "";

    document.getElementById("new_notes").value = "";
    document.getElementById("history").value = "";
    window.loadedPatientData = "";

    document.getElementById("patient_file").value = "";
}

function showToast(message, duration = 2500) {
    const container = document.getElementById("toast-container");

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    setTimeout(() => {
        toast.classList.remove("show");

        setTimeout(() => {
            toast.remove();
        }, 300);
    }, duration);
}
