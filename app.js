// app.js
const express = require('express');
const bodyParser = require('body-parser');
const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));

// Ruta para recibir mensajes de WhatsApp
app.post('/whatsapp', async (req, res) => {
  const userMessage = req.body.Body;
  console.log('Solicitud recibida desde Twilio:', req.body);

  // Verificar si el mensaje es un número de control válido
  const regex = /\d{6,8}/;
  if (!regex.test(userMessage)) {
    return res.status(400).send('El número de control no es válido.');
  }

  try {
    // Consultar la base de datos
    const calificaciones = await consultarCalificaciones(userMessage);
    if (calificaciones.calificaciones.length === 0) {
      return res.send('No se encontraron calificaciones para el número de control proporcionado.');
    }

    // Formatear las calificaciones como tabla
    const responseMessage = formatCalificaciones(calificaciones);

    const AuthToken = '[TokenReal]'; // 
    const IDTOKEN = '[IdToken]';

    const twilio = require('twilio')(IDTOKEN, AuthToken); // <-- Agrega AuthToken aquí
    await twilio.messages.create({
      body: responseMessage,
      from: 'whatsapp:+14155238886',
      to: req.body.From,
    });

    return res.send('Consulta exitosa. Se enviarán las calificaciones por WhatsApp.');
  } catch (error) {
    console.error('Error al procesar la solicitud:', error);
    return res.status(500).send('Ocurrió un error al procesar la solicitud.');
  }
});

// Iniciar el servidor
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`);
});

const sql = require('mssql');

// Configurar la conexión a la base de datos
const dbConfig = {
  user: 'usersql',
  password: 'root2',
  server: 'localhost',
  database: 'dbo',
  options: {
    encrypt: false
  }
};

// Función para realizar la consulta a la base de datos y obtener el nombre del estudiante
async function consultarCalificaciones(numeroControl) {
  try {
    await sql.connect(dbConfig);

    // Consultar el nombre del estudiante desde la tabla dbo.alumnos
    const alumnosQuery = `SELECT nombre FROM dbo.alumnos WHERE nControl = '${numeroControl}'`;
    const alumnosResult = await sql.query(alumnosQuery);

    // Verificar si se encontró el estudiante en la tabla
    if (alumnosResult.recordset.length === 0) {
      throw new Error('Estudiante no encontrado en la base de datos.');
    }

    const studentName = alumnosResult.recordset[0].nombre;

    // Consultar las calificaciones desde la tabla dbo.calificaciones
    const calificacionesQuery = `SELECT nControlAsignatura, calificacion FROM calificaciones WHERE nControl = '${numeroControl}'`;
    const calificacionesResult = await sql.query(calificacionesQuery);

    // Obtener el nombre de la asignatura para cada calificación
    const filteredCalificaciones = calificacionesResult.recordset.filter((calificacion) => calificacion.nControlAsignatura !== null);
    for (const calificacion of filteredCalificaciones) {
      const asignaturaQuery = `SELECT asignatura FROM asignaturas WHERE nControlAsignatura = '${calificacion.nControlAsignatura}'`;
      const asignaturaResult = await sql.query(asignaturaQuery);

      if (asignaturaResult.recordset.length > 0) {
        calificacion.asignatura = asignaturaResult.recordset[0].asignatura;
      }
    }

    return {
      studentName: studentName,
      calificaciones: filteredCalificaciones
    };
  } catch (error) {
    console.error('Error al consultar la base de datos:', error);
  } finally {
    sql.close();
  }
}

// Función para dar formato a las calificaciones como lista con un espacio de separación
function formatCalificaciones(calificaciones) {
  let message = `Calificaciones de *${calificaciones.studentName}*:\n`; // Nombre del alumno en negrita

  // Filas de la lista
  calificaciones.calificaciones.forEach((calificacion) => {
    message += `${calificacion.asignatura}: *${calificacion.calificacion}*\n`;
  });

  return message;
}
