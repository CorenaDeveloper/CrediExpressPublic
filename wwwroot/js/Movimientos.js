let tabla, listaPrtamos;
let prestamoSeleccionado = null;
let fechaCorteActual ;

$(document).ready(function () {

    // Inicializar fecha actual
    const hoy = new Date();
    const fechaLocal = new Date(hoy.getTime() - (hoy.getTimezoneOffset() * 60000));
    const fechaFormateada = fechaLocal.toISOString().split('T')[0];
    $('#fechaCorteSelect').val(fechaFormateada);

    $('#tablaMovimientos').DataTable();
    $('#tablaPrestamos').DataTable();


    $('#fechaCorteSelect').on('change', function () {
        fechaCorteActual = $(this).val();
        cargarMovimientosDia();
    });
    
    cargarMovimientosDia();

    // Event Listeners
    $('#btnDesembolsos').on('click', function () {
        $('#modalDesembolso').modal('show');
        $('#numeroSolicitud').focus();
    });

    $('#btnIngresarCobro').on('click', function () {
        $('#modalCobro').modal('show');
        $('#dui').focus();
    });

    $('#btnBuscarSolicitud').on('click', buscarSolicitud);
    $('#btnConfirmarDesembolso').on('click', confirmarDesembolso);
    $('#btnActualizar').on('click', cargarMovimientosDia);

    // Enter en campo de búsqueda
    $('#numeroSolicitud').on('keypress', function (e) {
        if (e.which === 13) {
            buscarSolicitud();
        }
    });

    function buscarSolicitud() {
        showLoadingSpinner();
        const numeroSolicitud = $('#numeroSolicitud').val().trim();

        if (!numeroSolicitud) {
            mostrarError('Ingrese un número de solicitud');
            return;
        }

        $.ajax({
            url: `/Crud/GetSolicitudParaDesembolso?id=${numeroSolicitud}`,
            method: 'GET',
            success: function (data) {
                if (data && data.success) {
                    mostrarDatosSolicitud(data.solicitud);
                } else {
                    hideLoadingSpinner();
                    mostrarError(data.message || 'Solicitud no encontrada o no está aprobada');

                }
            },
            error: function () {
                hideLoadingSpinner();
                mostrarError('Error al buscar la solicitud');
            }
        });
    }

    function mostrarDatosSolicitud(solicitud) {
        $('#nombreCliente').text(solicitud.nombreCliente);
        $('#duiCliente').text(solicitud.dui || 'No disponible');
        $('#telefonoCliente').text(solicitud.telefono || 'No disponible');
        $('#montoSolicitud').text(solicitud.monto.toFixed(2));
        $('#numeroCuotas').text(solicitud.numCoutas);
        $('#estadoSolicitud').html('<span class="badge bg-success">Aprobado</span>');

        $('#mensajeError').hide();
        $('#datosSolicitud').show();
        $('#btnConfirmarDesembolso').show();
        hideLoadingSpinner();
    }

    function confirmarDesembolso() {
        let numeroSolicitud = $('#numeroSolicitud').val();
        let tipoPago = $('#observacionesDesembolso').val();
        let fechaDesembolso = $('#fechaDesembolso').val();

        Swal.fire({
            title: '¿Confirmar Desembolso?',
            text: 'Esta acción cambiará el estado a DESEMBOLSADO',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#28a745',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, Desembolsar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                procesarDesembolso(numeroSolicitud, tipoPago, fechaDesembolso);
            }
        });
    }

    function procesarDesembolso(numeroSolicitud, tipoPago, fechaDesembolso) {
        // Mostrar loading
        Swal.fire({
            title: 'Procesando...',
            text: 'Registrando desembolso',
            allowOutsideClick: false,
            showConfirmButton: false,
            willOpen: () => {
                Swal.showLoading();
            }
        });

        $.ajax({
            url: '/Crud/ProcesarDesembolso',
            method: 'POST',
            data: {
                numeroSolicitud: numeroSolicitud,
                tipoPago: tipoPago,
                fechaDesembolso: fechaDesembolso
            },
            success: function (response) {
                if (response.success) {
                    // Obtener datos para el ticket PDF
                    const solicitudData = {
                        id: numeroSolicitud,
                        monto: parseFloat($('#montoSolicitud').text()),
                        numCoutas: parseInt($('#numeroCuotas').text()),
                        tipoPrestamo: 'MENSUAL' // Puedes mejorar esto obteniendo el tipo real
                    };

                    const clienteData = {
                        nombre: $('#nombreCliente').text().split(' ')[0] || 'Cliente',
                        apellido: $('#nombreCliente').text().split(' ').slice(1).join(' ') || '',
                        dui: $('#duiCliente').text(),
                        telefono: $('#telefonoCliente').text()
                    };

                    const gestorData = obtenerDatosUsuarioLogueado();

                    Swal.fire({
                        title: '¡Desembolso Exitoso!',
                        html: `
                            <div class="text-center">
                                <div class="alert alert-success mb-3">
                                    <i class="fas fa-check-circle fa-2x text-success mb-2"></i><br>
                                    <strong>Desembolso procesado correctamente</strong>
                                </div>
                                <p><strong>Solicitud:</strong> #${numeroSolicitud}</p>
                                <p><strong>Monto:</strong> ${solicitudData.monto.toFixed(2)}</p>
                                <p><strong>Cliente:</strong> ${clienteData.nombre} ${clienteData.apellido}</p>
                            </div>
                        `,
                        icon: 'success',
                        showCancelButton: true,
                        confirmButtonText: '<i class="fas fa-receipt me-1"></i>Generar Comprobante PDF',
                        cancelButtonText: '<i class="fas fa-check me-1"></i>Solo Continuar',
                        confirmButtonColor: '#198754',
                        cancelButtonColor: '#28a745'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            generarTicketDesembolsoPDF(solicitudData, clienteData, gestorData);
                        }
                    });

                    $('#modalDesembolso').modal('hide');
                    limpiarModalDesembolso();
                    cargarMovimientosDia();
                } else {
                    Swal.fire('Error', response.message, 'error');
                }
            },
            error: function () {
                Swal.fire('Error', 'Error al procesar el desembolso', 'error');
            }
        });
    }

    function limpiarModalDesembolso() {
        $('#numeroSolicitud').val('');
        $('#observacionesDesembolso').val('');
        $('#datosSolicitud').hide();
        $('#mensajeError').hide();
        $('#btnConfirmarDesembolso').hide();
    }

    // Limpiar modales al cerrar
    $('#modalDesembolso').on('hidden.bs.modal', limpiarModalDesembolso);
    $('#modalCobro').on('hidden.bs.modal', function () {
        $('#formCobro')[0].reset();
        nuevaBusqueda();
    });

    // Formato de campos monetarios
    $('#montoCapital').on('input', function () {
        let value = $(this).val().replace(/[^0-9.]/g, '');
        if (value.split('.').length > 2) {
            value = value.substring(0, value.lastIndexOf('.'));
        }
        $(this).val(value);
    });
});



function mostrarError(mensaje) {
    $('#textoError').text(mensaje);
    $('#mensajeError').show();
    $('#datosSolicitud').hide();
    $('#btnConfirmarDesembolso').hide();
    // Para el modal de cobro
    $('#seccionCliente').hide();
    $('#seccionFormularioCobro').hide();
    $('#registroCobro').hide();
    $('#btnNuevaBusqueda').hide();
}

function limpiarDatosCliente() {
    $('#seccionCliente').hide();
    $('#seccionFormularioCobro').hide();
    $('#registroCobro').hide();
    $('#btnNuevaBusqueda').hide();
    $('#dui').val('');
    $('#listaPrestamos').empty();
}

function mostrarDatosCliente(cliente) {
    // Llenar datos del cliente
    $("#clienteNombre").text(`${cliente.nombre || ''} ${cliente.apellido || ''}`.trim());
    $("#clienteDui").text(cliente.dui || 'Sin DUI');
    $("#clienteNit").text(cliente.nit || 'Sin NIT');
    $("#clienteTelefono").text(cliente.telefono || cliente.celular || 'Sin teléfono');
    $("#txtIdCliente").val(cliente.id);

    // Ocultar sección de búsqueda y mostrar sección de cliente
    $('#seccionBusqueda').hide();
    $('#seccionCliente').show();
    $('#mensajeError').hide();
    $('#btnNuevaBusqueda').show();
}

function nuevaBusqueda() {
    $('#seccionBusqueda').show();
    $('#seccionCliente').hide();
    $('#seccionFormularioCobro').hide();
    $('#registroCobro').hide();
    $('#seccionCronograma').hide(); 
    $('#mensajeError').hide();
    $('#btnNuevaBusqueda').hide();
    $('#dui').val('').focus();
    $('#formCobro')[0].reset();

    $('#prestamoFechaVencimiento').text('-');
}


// Función mejorada para buscar cliente
function busquedaCliente() {
    var dui = $('#dui').val().trim();
    var nombreApellido = $('#nombreApellido').val().trim();
    // Limpiar primero
    $('#rowSeleccionCliente').hide();
    $('#seccionCliente').hide();

    if (!dui && !nombreApellido) {
        Swal.fire("Error", "Ingrese un DUI o Nombre/Apellido para buscar", "error");
        return;
    }

    showLoadingSpinner();
    limpiarDatosCliente();

    $.ajax({
        url: `/Auxiliares/BuscarCliente?dui=${encodeURIComponent(dui)}&nombreApellido=${encodeURIComponent(nombreApellido)}`,
        method: 'GET',
        success: function (resp) {

            if (!resp || (Array.isArray(resp) && resp.length === 0)) {
                limpiarDatosCliente();
                hideLoadingSpinner();
                Swal.fire("Error", "No se encuentra cliente registrado.", "error");
                return;
            }

            // ✅ Si viene objeto único (DUI exacto)
            if (!Array.isArray(resp)) {
                mostrarDatosCliente(resp);
                buscarPrestamosActivos(resp.id);
            }
            // ✅ Si viene lista (por nombre o apellido)
            else {
                clienteActual = resp;
                mostrarCardSeleccionClientes(resp);
            }
        },
        error: function (xhr, status, error) {
            hideLoadingSpinner();
            Swal.fire("Error", "Error al consultar los datos del cliente", error);
        }
    });
}




// Función optimizada para móvil - reemplazar la función existente
function mostrarCardSeleccionClientes(clientes) {
    let clientesHTML = '';

    clientes.forEach(cliente => {
        const nombreCompleto = `${cliente.nombre || ''} ${cliente.apellido || ''}`.trim();

        // Card compacta para móvil
        clientesHTML += `
            <div class="card mb-2 border-0 shadow-sm" style="cursor: pointer;" onclick="seleccionarClienteDetalle(${cliente.id})">
                <div class="card-body p-3">
                    <div class="row align-items-center">
                        <div class="col-8">
                            <h6 class="card-title mb-1 text-primary">${nombreCompleto}</h6>
                            <small class="text-muted">
                                <i class="fas fa-id-card me-1"></i>${cliente.dui || 'Sin DUI'}
                            </small>
                        </div>
                        <div class="col-4 text-end">
                            <i class="fas fa-chevron-right text-muted"></i>
                            <br><small class="text-info">${cliente.telefono || cliente.celular || 'S/T'}</small>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    $('#clientesEncontrados').html(clientesHTML);
    hideLoadingSpinner();

    // Guardar clientes para selección posterior
    window.clientesTemp = clientes;

    // Mostrar la sección de selección
    $('#rowSeleccionCliente').show();
}

// Función para seleccionar cliente del listado
function seleccionarClienteDetalle(idCliente) {
    const cliente = window.clientesTemp.find(c => c.id === idCliente);

    if (!cliente) {
        Swal.fire('Error', 'Cliente no encontrado', 'error');
        return;
    }

    // Ocultar la lista de selección
    $('#rowSeleccionCliente').hide();

    mostrarDatosCliente(cliente);
    buscarPrestamosActivos(cliente.id);
}

function cargarMovimientosDia() {
    const fecha = $('#fechaCorteSelect').val();

    showLoadingSpinner();

    $.ajax({
        url: `/Crud/GetMovimientosDiariosCompleto?fecha=${fecha}`,
        method: 'GET',
        success: function (response) {
            let totalIngresos = 0;
            let totalEgresos = 0;
            let totalMovimientos = 0;

            if (response.success && response.data && Array.isArray(response.data)) {
                let datosTabla = response.data;
                let resumen = response.resumen;

                totalIngresos = resumen.ingresosDia;
                totalEgresos = resumen.egresosDia;
                totalMovimientos = resumen.totalMovimientos;

                if ($.fn.DataTable.isDataTable('#tablaMovimientos')) {
                    $('#tablaMovimientos').DataTable().destroy();
                }

                tabla = $('#tablaMovimientos').DataTable({
                    data: datosTabla,
                    scrollCollapse: true,
                    scrollX: true,
                    layout: {
                        topStart: {
                            buttons: [
                                {
                                    extend: 'excelHtml5',
                                    autoFilter: true,
                                    sheetName: 'Exported data'
                                }
                            ]
                        }
                    },
                    fixedColumns: {
                        leftColumns: 1
                    },
                    columns: [
                        {
                            data: "concepto",
                            render: d => `<div><small>${d || 'N/A'}</small></div>`
                        },
                        {
                            data: "cliente",
                            render: (d, t, row) => `<div><small>${d || 'N/A'}</small></div>`
                        },
                        {
                            data: "monto",
                            render: (d, t, row) => `<div class="text-center monto-ingreso">${(row.tipo == 'INGRESO' ? parseFloat(d || 0) : 0).toFixed(2)}</div>`
                        },
                        {
                            data: "monto",
                            render: (d, t, row) => `<div class="text-center monto-egreso">${(row.tipo != 'INGRESO' ? parseFloat(d || 0) : 0).toFixed(2)}</div>`
                        },
                        {
                            data: "usuario",
                            render: d => `<div class="text-center">${d || 'Indefinido'}</div>`
                        },
                        {
                            data: null,
                            render: (d, t, row) => `<button class="btn btn-sm btn-outline-primary" onclick="verDetalle(${row.id})">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="revertirPago(${row.id}, '${row.concepto}', ${row.monto})">
                                <i class="fas fa-undo"></i>
                            </button>`
                        }
                    ],
                    order: [[0, 'desc']],
                    columnDefs: [
                        { targets: [2, 3], className: 'text-center' }, // Ingresos y Egresos
                        { targets: [5], orderable: false } // Columna de acciones
                    ]
                });
            }

            $('#totalIngresos').text('$' + totalIngresos.toFixed(2));
            $('#totalEgresos').text('$' + totalEgresos.toFixed(2));
            $('#contadorMovimientos').text(totalMovimientos);

            $('#ingresosDia').text('$' + totalIngresos.toFixed(2));
            $('#egresosDia').text('$' + totalEgresos.toFixed(2));
            $('#totalMovimientos').text(totalMovimientos || 0);

            hideLoadingSpinner();
        },
        error: function () {
            Swal.fire('Error', 'Error al cargar los movimientos del día', 'error');
            hideLoadingSpinner();
        }
    });
}

function revertirPago(idMovimiento, concepto, monto) {
    Swal.fire({
        title: '¿Revertir este pago?',
        html: `
            <div class="text-start">
                <p><strong>Movimiento:</strong> ${concepto}</p>
                <p><strong>Monto:</strong> $${monto.toFixed(2)}</p>
                <p class="text-danger"><i class="fas fa-exclamation-triangle"></i> Esta acción no se puede deshacer</p>
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, revertir',
        cancelButtonText: 'Cancelar',
        input: 'text',
        inputPlaceholder: 'Motivo de la reversión (obligatorio)',
        inputValidator: (value) => {
            if (!value || value.trim() === '') {
                return 'Debe ingresar un motivo para la reversión';
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const motivo = result.value;

            // Mostrar spinner de carga
            showLoadingSpinner();

            // Llamar al endpoint de reversión
            $.ajax({
                url: '/Crud/RevertirPago',
                method: 'POST',
                data: {
                    idMovimiento: idMovimiento,
                    motivo: motivo
                },
                success: function (response) {
                    hideLoadingSpinner();

                    if (response.success) {
                        Swal.fire({
                            title: '¡Reversión exitosa!',
                            text: response.message,
                            icon: 'success'
                        }).then(() => {
                            cargarMovimientosDia();
                        });
                    } else {
                        Swal.fire({
                            title: 'Error',
                            text: response.message || 'No se pudo revertir el pago',
                            icon: 'error'
                        });
                    }
                },
                error: function () {
                    hideLoadingSpinner();
                    Swal.fire({
                        title: 'Error',
                        text: 'Ocurrió un error al comunicarse con el servidor',
                        icon: 'error'
                    });
                }
            });
        }
    });
}

function mostrarOpcionesPDF(docDefinition, titulo, nombreArchivo) {
    Swal.fire({
        title: titulo,
        text: '¿Qué desea hacer con el documento?',
        icon: 'question',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: '<i class="fas fa-download me-1"></i>Descargar PDF',
        denyButtonText: '<i class="fas fa-eye me-1"></i>Ver Vista Previa',
        cancelButtonText: '<i class="fas fa-times me-1"></i>Cerrar',
        confirmButtonColor: '#198754',
        denyButtonColor: '#0d6efd',
        cancelButtonColor: '#6c757d'
    }).then((result) => {
        if (result.isConfirmed) {
            pdfMake.createPdf(docDefinition).download(`${nombreArchivo}.pdf`);
            showAlert('success', 'PDF descargado exitosamente');
        } else if (result.isDenied) {
            pdfMake.createPdf(docDefinition).open();
        }
    });
}

function obtenerDatosUsuarioLogueado() {
    return {
        nombre: 'Sistema',
        apellido: 'Administrativo'
    };
}

function verDetalle(idMovimiento) {
    // Mostrar loading
    Swal.fire({
        title: 'Cargando...',
        text: 'Obteniendo detalles del movimiento',
        allowOutsideClick: false,
        showConfirmButton: false,
        willOpen: () => {
            Swal.showLoading();
        }
    });

    // ✅ Usar tu método existente con el parámetro adicional
    $.ajax({
        url: `/Crud/GetMovimientosDetallado?idMovimiento=${idMovimiento}`,
        method: 'GET',
        success: function (response) {
            if (response.success && response.data) {
                let movimiento = response.data;
                const monto = parseFloat(movimiento.monto) || 0;
                const esIngreso = movimiento.tipo === "INGRESO";
                const esEgreso = movimiento.tipo === "EGRESO";

                // Determinar clase de badge e ícono
                const badgeClass = esIngreso ? 'bg-success' : 'bg-danger';
                const iconClass = esIngreso ? 'fas fa-arrow-down' : 'fas fa-arrow-up';

                // Crear el contenido del modal con DATOS REALES
                const modalContent = `
        <div class="text-start">
            <!-- Encabezado del movimiento -->
            <div class="alert alert-info mb-4">
                <div class="row align-items-center">
                    <div class="col-2 text-center">
                        <i class="${iconClass} fa-2x"></i>
                    </div>
                    <div class="col-10">
                        <h5 class="mb-1">
                            <span class="badge ${badgeClass} fs-6 me-2">${movimiento.tipo}</span>
                            Movimiento #${movimiento.id}
                        </h5>
                        <p class="mb-0 text-muted">
                            <i class="fas fa-calendar me-1"></i>${movimiento.fechaPago || 'N/A'} - 
                            <i class="fas fa-clock me-1"></i>${movimiento.hora}
                        </p>
                    </div>
                </div>
            </div>

            <!-- Información principal -->
            <div class="row mb-4">
                <div class="col-md-6">
                    <div class="card border-primary">
                        <div class="card-header bg-primary text-white">
                            <h6 class="mb-0"><i class="fas fa-info-circle me-2"></i>Información General</h6>
                        </div>
                        <div class="card-body">
                            <table class="table table-borderless mb-0">
                                <tr>
                                    <td><strong>Concepto:</strong></td>
                                    <td>${movimiento.concepto || 'No especificado'}</td>
                                </tr>
                                <tr>
                                    <td><strong>Método de Pago:</strong></td>
                                    <td>${movimiento.tipoPago || 'EFECTIVO'}</td>
                                </tr>
                                <tr>
                                    <td><strong>Usuario Responsable:</strong></td>
                                    <td>${movimiento.usuario || 'Sistema'}</td>
                                </tr>
                                <tr>
                                    <td><strong>Número de Cuota:</strong></td>
                                    <td>${movimiento.numeropago && movimiento.numeropago > 0 ? `Cuota #${movimiento.numeropago}` : 'N/A'}</td>
                                </tr>
                                <tr>
                                    <td><strong>Préstamo:</strong></td>
                                    <td>#${movimiento.idPrestamo || 'N/A'}</td>
                                </tr>
                                <tr>
                                    <td><strong>Estado:</strong></td>
                                    <td>${movimiento.pagado == 1 ?
                        '<span class="badge bg-success">Procesado</span>' :
                        '<span class="badge bg-warning">Pendiente</span>'}</td>
                                </tr>
                            </table>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-6">
                    <div class="card border-success">
                        <div class="card-header bg-success text-white">
                            <h6 class="mb-0"><i class="fas fa-dollar-sign me-2"></i>Información Financiera</h6>
                        </div>
                        <div class="card-body">
                            <div class="text-center mb-3">
                                <h3 class="text-success mb-0">$${monto.toFixed(2)}</h3>
                                <small class="text-muted">Monto Total</small>
                            </div>
                            
                            <!-- ✅ DESGLOSE REAL CON DATOS DEL SERVIDOR -->
                            ${(movimiento.capital || movimiento.interes || movimiento.mora) ? `
                                <hr>
                                <h6 class="mb-2">Desglose Financiero:</h6>
                                <table class="table table-sm">
                                    ${movimiento.capital && movimiento.capital > 0 ? `
                                        <tr>
                                            <td><i class="fas fa-university me-1"></i>Capital:</td>
                                            <td class="text-end fw-bold text-primary">$${parseFloat(movimiento.capital).toFixed(2)}</td>
                                        </tr>
                                    ` : ''}
                                    ${movimiento.interes && movimiento.interes > 0 ? `
                                        <tr>
                                            <td><i class="fas fa-percentage me-1"></i>Interés:</td>
                                            <td class="text-end fw-bold text-info">$${parseFloat(movimiento.interes).toFixed(2)}</td>
                                        </tr>
                                    ` : ''}
                                    ${movimiento.mora && movimiento.mora > 0 ? `
                                        <tr>
                                            <td><i class="fas fa-exclamation-triangle me-1"></i>Mora:</td>
                                            <td class="text-end fw-bold text-warning">$${parseFloat(movimiento.mora).toFixed(2)}</td>
                                        </tr>
                                    ` : ''}
                                    ${movimiento.morahist && movimiento.morahist > 0 ? `
                                        <tr>
                                            <td><i class="fas fa-history me-1"></i>Mora Histórica:</td>
                                            <td class="text-end fw-bold text-secondary">$${parseFloat(movimiento.morahist).toFixed(2)}</td>
                                        </tr>
                                    ` : ''}
                                </table>
                            ` : `
                                <div class="alert alert-light text-center">
                                    <i class="fas fa-info-circle me-1"></i>
                                    <small>Movimiento sin desglose detallado</small>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Información del cliente -->
            <div class="card border-info mb-4">
                <div class="card-header bg-info text-white">
                    <h6 class="mb-0"><i class="fas fa-user me-2"></i>Información del Cliente</h6>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <p class="mb-1"><strong><i class="fas fa-user me-1"></i>Nombre:</strong> ${movimiento.cliente || 'No especificado'}</p>
                            ${movimiento.duiCliente ? `<p class="mb-1"><strong><i class="fas fa-id-card me-1"></i>DUI:</strong> ${movimiento.duiCliente}</p>` : ''}
                            ${movimiento.telefonoCliente ? `<p class="mb-0"><strong><i class="fas fa-phone me-1"></i>Teléfono:</strong> ${movimiento.telefonoCliente}</p>` : ''}
                        </div>
                        <div class="col-md-6">
                            ${movimiento.montoPrestamo ? `<p class="mb-1"><strong><i class="fas fa-money-bill me-1"></i>Monto Préstamo:</strong> $${parseFloat(movimiento.montoPrestamo).toFixed(2)}</p>` : ''}
                            ${movimiento.tipoPrestamo ? `<p class="mb-1"><strong><i class="fas fa-calendar me-1"></i>Tipo:</strong> ${movimiento.tipoPrestamo}</p>` : ''}
                            ${movimiento.estadoPrestamo ? `<p class="mb-0"><strong><i class="fas fa-flag me-1"></i>Estado:</strong> 
                                <span class="badge ${movimiento.estadoPrestamo === 'A' ? 'bg-success' :
                            movimiento.estadoPrestamo === 'C' ? 'bg-primary' : 'bg-secondary'}">
                                    ${movimiento.estadoPrestamo === 'A' ? 'Activo' :
                            movimiento.estadoPrestamo === 'C' ? 'Cancelado' : 'Otro'}
                                </span></p>` : ''}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Observaciones automáticas -->
            <div class="card border-warning">
                <div class="card-header bg-warning">
                    <h6 class="mb-0"><i class="fas fa-comment me-2"></i>Observaciones del Sistema</h6>
                </div>
                <div class="card-body">
                    <ul class="list-unstyled mb-0">
                        ${movimiento.pagado == 1 ?
                        '<li><i class="fas fa-check-circle text-success me-2"></i>Transacción procesada exitosamente</li>' :
                        '<li><i class="fas fa-clock text-warning me-2"></i>Transacción pendiente de procesamiento</li>'}
                        
                        ${movimiento.tipo === "EGRESO" ?
                        '<li><i class="fas fa-money-bill-wave text-primary me-2"></i>Dinero entregado al cliente (desembolso)</li>' :
                        '<li><i class="fas fa-hand-holding-usd text-success me-2"></i>Dinero recibido del cliente (pago)</li>'}
                        
                        ${movimiento.mora && movimiento.mora > 0 ?
                        `<li><i class="fas fa-exclamation-triangle text-warning me-2"></i>Incluye recargo por mora: $${parseFloat(movimiento.mora).toFixed(2)}</li>` : ''}
                        
                        ${movimiento.estadoPrestamo === 'C' ?
                        '<li><i class="fas fa-trophy text-success me-2"></i>¡Este movimiento completó la liquidación del préstamo!</li>' : ''}
                    </ul>
                </div>
            </div>
        </div>
    `;

                // Mostrar el modal
                Swal.fire({
                    title: `<i class="${iconClass} me-2"></i>Detalle Completo del Movimiento`,
                    html: modalContent,
                    width: '900px',
                    showCancelButton: true,
                    showConfirmButton: true,
                    confirmButtonText: '<i class="fas fa-receipt me-1"></i>Generar Comprobante',
                    cancelButtonText: '<i class="fas fa-times me-1"></i>Cerrar',
                    confirmButtonColor: '#198754',
                    cancelButtonColor: '#6c757d',
                    customClass: {
                        container: 'swal-wide'
                    }
                }).then((result) => {
                    if (result.isConfirmed) {
                        // Generar comprobante con datos completos
                        generarComprobanteCompleto(movimiento);
                    }
                });

            } else {
                Swal.fire({
                    title: 'Error',
                    text: response.message || 'No se pudo obtener el detalle del movimiento',
                    icon: 'error',
                    confirmButtonColor: '#dc3545'
                });
            }
        },
        error: function (xhr, status, error) {
            console.error('Error al obtener detalle:', error);
            Swal.fire({
                title: 'Error de Conexión',
                text: 'No se pudo conectar con el servidor para obtener los detalles',
                icon: 'error',
                confirmButtonColor: '#dc3545'
            });
        }
    });
}


// NUEVA FUNCIÓN para obtener préstamos con calendario
function buscarPrestamosActivos(idCliente) {
    $.ajax({
        url: `/Crud/buscarPrestamosActivos?idCliente=${idCliente}`,
        method: 'GET',
        success: function (data) {
            if (data && data.success && Array.isArray(data.data)) {
                if (data.data.length === 0) {
                    mostrarError("No se encontraron préstamos activos para este cliente");
                    return;
                }
                mostrasListaPrestamos(data.data);
            } else {
                hideLoadingSpinner();
                mostrarError("No se encontraron préstamos activos para este cliente");

            }
        },
        error: function (xhr, status, error) {
            hideLoadingSpinner();
            console.error('Error al buscar préstamos:', error);
            mostrarError('Error al buscar los préstamos. Intente nuevamente.');
        }
    });
}


// NUEVA FUNCIÓN para mostrar préstamos con información del calendario
function mostrasListaPrestamos(prestamos) {
   
    if ($.fn.DataTable.isDataTable('#tablaPrestamos')) {
        $('#tablaPrestamos').DataTable().destroy();
    }

    // Inicializar DataTable
    listaPrtamos = new DataTable('#tablaPrestamos', {
        data: prestamos,
        columns: [
            {
                data: "id",
                render: (d, t, row) => `<strong>#${row.id}</strong><br><small>${row.tipoPrestamo}</small>`
            },
            {
                data: "monto",
                render: d => `<div class="text-center">${(d || 0).toFixed(2)}</div>`
            },
            {
                data: "montoCuota",
                render: d => `<div class="text-center">${(d || 0).toFixed(2)}</div>`
            },
            {
                data: "abonosRealizados",
                render: d => `<div class="text-center">${d || 0}</div>`
            },
            {
                data: "cuotasPagadas",
                render: d => `<div class="text-center">${(d || 0).toFixed(2)}</div>`
            },
            {
                data: "saldoPagado",
                render: d => `<div class="text-center">${(d || 0).toFixed(2)}</div>`
            },
            {
                data: "saldoPendiente",
                render: d => `<div class="text-center">${(d || 0).toFixed(2)}</div>`
            },
            {
                data: "diasMora",
                render: d => `<div class="text-center">${(d || 0)}</div>`
            },
            {
                data: "cuotasEnMora",
                render: d => `<div class="text-center">${(d || 0)}</div>`
            },
            {
                data: "saldoEnMora",
                render: d => `<div class="text-center">${(d || 0)}</div>`
            },
            {
                data: "proximoPagoSegunPrestamo",
                render: d => `<div class="text-center"><small>${d || 'N/A'}</small></div>`
            }
        ],
        scrollCollapse: true,
        scrollY: "300px",
        scrollX: true,
        paging: false,
        searching: false,
        info: false,
        select: {
            style: 'single'
        },
        fixedColumns: {
            leftColumns:1
        },
        order: [[0, 'desc']],
        rowCallback: function (row, data, index) {
            if (data.tieneMora === true || data.diasMora > 0) {
                if (data.diasMora > 30) {
                    // Mora severa
                    $(row).css({
                        'background-color': '#ffcdd2',
                        'color': '#b71c1c'
                    });
                } else if (data.diasMora > 15) {
                    // Mora moderada
                    $(row).css({
                        'background-color': '#ffebee',
                        'color': '#d32f2f'
                    });
                } else if (data.diasMora > 0) {
                    // Mora leve
                    $(row).css({
                        'background-color': '#fff3e0',
                        'color': '#e65100'
                    });
                }
            }
        }
    });

    listaPrtamos.on('select', function (e, dt, type, indexes) {
        let rowData = listaPrtamos.row(indexes[0]).data();
        console.log("Objeto completo:", rowData);

        prestamoSeleccionado = rowData;

        $('#seccionFormularioCobro').show();
        $("#prestamoIdSeleccionado").html(rowData.id);
        $("#prestamoCuotaMensual").html(rowData.montoCuota);
        $("#prestamoTipo").html(rowData.tipoPrestamo);

    });
    hideLoadingSpinner();
}


function procederCobro() {
    const form = $('#formCobro')[0];
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    };

    const $btnGuardar = $('#btnGuardarCobro');
    if ($btnGuardar.prop('disabled')) {
        return;
    }

    $btnGuardar.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-1"></i>Procesando...');


    Swal.fire({
        title: 'Confirmar Cobro',
        html: mostrarResumenCobro(),
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-check me-1"></i>Confirmar Cobro',
        cancelButtonText: '<i class="fas fa-times me-1"></i>Cancelar',
        confirmButtonColor: '#198754',
        cancelButtonColor: '#6c757d',
        width: '500px'
    }).then((result) => {
        if (result.isConfirmed) {
            generarCobro(); 
        } else {
            $btnGuardar.prop('disabled', false).html('<i class="fas fa-save me-2"></i>Registrar Cobro');
        }
    });
}


function mostrarResumenCobro() {

    if (!prestamoSeleccionado) {
        Swal.fire('Error', 'No hay préstamo seleccionado', 'error');
        return;
    }

    const montoTotal = parseFloat($('#montoCapital').val()) || 0;
    const metodoPago = $('#metodoPago').val() || 'EFECTIVO';

    const resumenHTML = `
        <div class="text-start">
            <div class="alert alert-info">
                <h6><i class="fas fa-info-circle me-2"></i>Resumen del Cobro</h6>
            </div>
            
            <div class="row mb-3">
                <div class="col-6"><strong>Préstamo:</strong></div>
                <div class="col-6">#${prestamoSeleccionado.id} (${prestamoSeleccionado.tipoPrestamo})</div>
            </div>
            
            <div class="row mb-3">
                <div class="col-6"><strong>Monto Original:</strong></div>
                <div class="col-6">$${prestamoSeleccionado.monto.toFixed(2)}</div>
            </div>
            
            <div class="row mb-3">
                <div class="col-6"><strong>Saldo Pendiente:</strong></div>
                <div class="col-6 text-warning">$${prestamoSeleccionado.saldoPendiente.toFixed(2)}</div>
            </div>
            
            ${prestamoSeleccionado.tieneMora ? `
                <div class="row mb-3">
                    <div class="col-6"><strong>Cuotas en Mora:</strong></div>
                    <div class="col-6 text-danger">${prestamoSeleccionado.cuotasEnMora} (${prestamoSeleccionado.diasMora} días)</div>
                </div>
                <div class="row mb-3">
                    <div class="col-6"><strong>Saldo en Mora:</strong></div>
                    <div class="col-6 text-danger">$${prestamoSeleccionado.saldoEnMora.toFixed(2)}</div>
                </div>
            ` : ''}
            
            <hr>
            <h6>Desglose del Pago:</h6>
            <div class="row mb-3 border-top pt-2">
                <div class="col-6"><strong>TOTAL A COBRAR:</strong></div>
                <div class="col-6 fw-bold text-success fs-5">$${montoTotal.toFixed(2)}</div>
            </div>
            
            <div class="row mb-2">
                <div class="col-6">Método de Pago:</div>
                <div class="col-6">${metodoPago}</div>
            </div>
        </div>
    `;

    return resumenHTML;
}

function generarCobro() {
    Swal.fire({
        title: 'Procesando...',
        text: 'Registrando cobro',
        allowOutsideClick: false,
        showConfirmButton: false,
        willOpen: () => {
            Swal.showLoading();
        }
    });

    const $btnGuardar = $('#btnGuardarCobro');

    const montoAbonar = parseFloat($('#montoCapital').val()) || 0;
    const metodoPago = $('#metodoPago').val() || 'EFECTIVO';
    const observaciones = $('#observacionesCobro').val() || '';

    const data = {
        idPrestamo: prestamoSeleccionado.id,
        abonosRealizados: prestamoSeleccionado.abonosRealizados,
        montoAbonar: montoAbonar,
        metodoPago: metodoPago || 'EFECTIVO',
        observaciones: observaciones,
        diasMora: prestamoSeleccionado.diasMora || 0,
        cuotasEnMora: prestamoSeleccionado.cuotasEnMora || 0,
        interesPendiente: prestamoSeleccionado.interesPendiente || 0,
        fechaEstimadaPago: prestamoSeleccionado.proximoPagoSegunPrestamo || '',
        saldoAlDia: prestamoSeleccionado.saldoEnMora || 0,
        montoCuota: prestamoSeleccionado.montoCuota || 0,
        capitalPendiente: prestamoSeleccionado.capitalPendiente || 0,
        domicilioPendiente: prestamoSeleccionado.domicilioPendiente || 0,
        tieneMora: prestamoSeleccionado.tieneMora || false,
        interesXcuota: prestamoSeleccionado.interesXcuota || 0,
        domicilioXcuota: prestamoSeleccionado.domicilioXcuota || 0,
        capitalXcuota: prestamoSeleccionado.capitalXcuota || 0,
    };

    console.log(data);


    $.ajax({
        url: '/Crud/RegistrarPago',
        method: 'POST',
        data: data,
        success: function (response) {
            $btnGuardar.prop('disabled', false).html('<i class="fas fa-save me-2"></i>Registrar Cobro');

            if (response.success) {
                // Usar los datos REALES de distribución que devuelve el servidor
                const distribucionReal = response.data.distribucion;

                const datosCobro = {
                    idCobro: response.data?.idMovimiento || new Date().getTime(),
                    numeroCuota: data.numeroCuota,
                    montoTotal: distribucionReal.total,
                    cliente: {
                        nombre: $('#clienteNombre').text().split(' ')[0] || 'Cliente',
                        apellido: $('#clienteNombre').text().split(' ').slice(1).join(' ') || '',
                        dui: $('#clienteDui').text()
                    },
                    // USAR LA DISTRIBUCIÓN REAL DEL SERVIDOR
                    montoCapital: distribucionReal.capital,
                    montoInteres: distribucionReal.interes,
                    montoDomicilio: distribucionReal.domicilio,
                    montoMora: 0, 
                    metodoPago: data.metodoPago,
                    observaciones: data.observaciones || '',
                    concepto: data.concepto || 'CUOTA_COMPLETA',
                    idPrestamo: data.idPrestamo,
                    idCliente: data.idCliente
                };

                const estadoPrestamo = response.data?.estadoPrestamo === 'C';

                if ($.fn.DataTable.isDataTable('#tablaPrestamos')) {
                    $('#tablaPrestamos').DataTable().destroy();
                }


                Swal.fire({
                    title: '¡Cobro Registrado!',
                    html: `
                    <div class="text-center">
                        <div class="alert alert-success mb-3">
                            <i class="fas fa-check-circle fa-2x text-success mb-2"></i><br>
                            <strong>Pago registrado exitosamente</strong>
                        </div>
                        <p><strong>Recibo:</strong> #${datosCobro.idCobro}</p>
                        <p><strong>Cuota:</strong> #${datosCobro.numeroCuota}</p>
                        
                        <!-- MOSTRAR DISTRIBUCIÓN REAL -->
                        <div class="alert alert-info">
                            <strong>Distribución Aplicada:</strong><br>
                            <strong>Total: $${distribucionReal.total.toFixed(2)}</strong>
                        </div>
                        
                        <p><strong>Cliente:</strong> ${datosCobro.cliente.nombre} ${datosCobro.cliente.apellido}</p>
                        ${estadoPrestamo ?
                            '<div class="alert alert-success mt-2"><i class="fas fa-trophy me-1"></i>¡Préstamo completamente liquidado!</div>' :
                            ''}
                    </div>
                `,
                    icon: 'success',
                    showCancelButton: true,
                    confirmButtonText: '<i class="fas fa-receipt me-1"></i>Generar Recibo PDF',
                    cancelButtonText: '<i class="fas fa-check me-1"></i>Solo Continuar',
                    confirmButtonColor: '#198754',
                    cancelButtonColor: '#28a745'
                }).then((result) => {
                    if (result.isConfirmed) {
                        generarTicketCobroPDF(datosCobro);
                    }
                });

                $('#modalCobro').modal('hide');
                $('#formCobro')[0].reset();
                nuevaBusqueda();
                cargarMovimientosDia();
            } else {
                Swal.fire('Error', response.message || 'Error al registrar el cobro', 'error');
            }
        },
        error: function (xhr, status, error) {
            $btnGuardar.prop('disabled', false).html('<i class="fas fa-save me-2"></i>Registrar Cobro');
            console.error('Error AJAX:', error);
            Swal.fire('Error', 'Error al conectar con el servidor', 'error');
        }
    });
};



function generarTicketDesembolsoPDF(solicitudData, clienteData, gestorData) {
    const fecha = new Date();
    const fechaFormateada = fecha.toLocaleDateString('es-ES');
    const horaFormateada = fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    const docDefinition = {
        pageSize: { width: 226.77, height: 'auto' },
        pageMargins: [10, 10, 10, 10],
        defaultStyle: { fontSize: 9 },
        content: [
            {
                text: 'CREDI-EXPRESS DE EL SALVADOR',
                fontSize: 11,
                bold: true,
                alignment: 'center',
                margin: [0, 0, 0, 5]
            },
            {
                text: 'COMPROBANTE DE DESEMBOLSO',
                fontSize: 10,
                bold: true,
                alignment: 'center',
                margin: [0, 0, 0, 10]
            },
            {
                canvas: [{ type: 'line', x1: 0, y1: 0, x2: 206, y2: 0, lineWidth: 1 }],
                margin: [0, 0, 0, 10]
            },
            {
                table: {
                    widths: ['30%', '70%'],
                    body: [
                        [{ text: 'FECHA:', bold: true }, fechaFormateada],
                        [{ text: 'HORA:', bold: true }, horaFormateada],
                        [{ text: 'SOLICITUD:', bold: true }, `#${solicitudData.id}`]
                    ]
                },
                layout: 'noBorders',
                margin: [0, 0, 0, 10]
            },
            {
                text: 'DATOS DEL CLIENTE',
                fontSize: 9,
                bold: true,
                decoration: 'underline',
                margin: [0, 0, 0, 5]
            },
            {
                table: {
                    widths: ['100%'],
                    body: [
                        [{ text: `${clienteData.nombre} ${clienteData.apellido}`, fontSize: 9, bold: true }],
                        [{ text: `DUI: ${clienteData.dui}` }],
                        [{ text: `TEL: ${clienteData.telefono}` }]
                    ]
                },
                layout: 'noBorders',
                margin: [0, 0, 0, 10]
            },
            {
                text: 'DETALLE DEL PRÉSTAMO',
                fontSize: 9,
                bold: true,
                decoration: 'underline',
                margin: [0, 5, 0, 5]
            },
            {
                table: {
                    widths: ['40%', '60%'],
                    body: [
                        [{ text: 'MONTO:', bold: true }, { text: `$${solicitudData.monto.toFixed(2)}`, bold: true, color: '#2E7D32' }],
                        [{ text: 'CUOTAS:', bold: true }, solicitudData.numCoutas.toString()],
                        [{ text: 'TIPO:', bold: true }, solicitudData.tipoPrestamo]
                    ]
                },
                layout: 'noBorders',
                margin: [0, 0, 0, 15]
            },
            {
                table: {
                    widths: ['100%'],
                    body: [
                        [{ text: 'TOTAL DESEMBOLSADO', fontSize: 10, bold: true, alignment: 'center', fillColor: '#f0f0f0' }],
                        [{ text: `$${solicitudData.monto.toFixed(2)}`, fontSize: 14, bold: true, color: '#1976D2', alignment: 'center', fillColor: '#f0f0f0' }]
                    ]
                },
                margin: [0, 10, 0, 15]
            },
            {
                text: 'CREDI-EXPRESS DE EL SALVADOR\nGracias por su confianza',
                alignment: 'center',
                fontSize: 7,
                italics: true,
                margin: [0, 20, 0, 0]
            }
        ]
    };

    mostrarOpcionesPDF(docDefinition, 'COMPROBANTE DE DESEMBOLSO', `Desembolso_${solicitudData.id}_${Date.now()}`);
}


function generarTicketCobroPDF(datosCobro) {
    const fecha = new Date();
    const fechaFormateada = fecha.toLocaleDateString('es-ES');
    const horaFormateada = fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    const docDefinition = {
        pageSize: { width: 226.77, height: 'auto' },
        pageMargins: [10, 10, 10, 10],
        defaultStyle: { fontSize: 9 },
        content: [
            {
                text: 'CREDI-EXPRESS DE EL SALVADOR',
                fontSize: 11,
                bold: true,
                alignment: 'center',
                margin: [0, 0, 0, 5]
            },
            {
                text: 'RECIBO DE PAGO',
                fontSize: 10,
                bold: true,
                alignment: 'center',
                margin: [0, 0, 0, 10]
            },
            {
                canvas: [{ type: 'line', x1: 0, y1: 0, x2: 206, y2: 0, lineWidth: 1 }],
                margin: [0, 0, 0, 10]
            },
            {
                table: {
                    widths: ['30%', '70%'],
                    body: [
                        [{ text: 'FECHA:', bold: true }, fechaFormateada],
                        [{ text: 'HORA:', bold: true }, horaFormateada],
                        [{ text: 'RECIBO:', bold: true }, `#${datosCobro.idCobro}`],
                        [{ text: 'PRÉSTAMO:', bold: true }, `#${datosCobro.idPrestamo || 'N/A'}`]
                    ]
                },
                layout: 'noBorders',
                margin: [0, 0, 0, 10]
            },
            {
                text: 'CLIENTE',
                fontSize: 9,
                bold: true,
                decoration: 'underline',
                margin: [0, 0, 0, 5]
            },
            {
                table: {
                    widths: ['100%'],
                    body: [
                        [{ text: `${datosCobro.cliente.nombre} ${datosCobro.cliente.apellido}`, fontSize: 9, bold: true }],
                        [{ text: `DUI: ${datosCobro.cliente.dui}` }]
                    ]
                },
                layout: 'noBorders',
                margin: [0, 0, 0, 10]
            },
            {
                table: {
                    widths: ['100%'],
                    body: [
                        [{ text: 'MONTO PAGADO', fontSize: 12, bold: true, alignment: 'center', fillColor: '#e8f5e8' }],
                        [{ text: `$${datosCobro.montoTotal.toFixed(2)}`, fontSize: 16, bold: true, color: '#1976D2', alignment: 'center', fillColor: '#e8f5e8' }]
                    ]
                },
                margin: [0, 0, 0, 15]
            },
            {
                text: 'MÉTODO DE PAGO',
                fontSize: 9,
                bold: true,
                decoration: 'underline',
                margin: [0, 10, 0, 5]
            },
            {
                table: {
                    widths: ['100%'],
                    body: [
                        [{ text: datosCobro.metodoPago || 'EFECTIVO', fontSize: 10, bold: true, alignment: 'center' }]
                    ]
                },
                layout: 'noBorders',
                margin: [0, 0, 0, 15]
            },
            {
                text: 'DESCUENTOS APLICADOS',
                fontSize: 9,
                bold: true,
                decoration: 'underline',
                margin: [0, 10, 0, 5]
            },
            {
                table: {
                    widths: ['60%', '40%'],
                    body: [
                        [{ text: 'Descuento aplicado:', bold: true }, { text: '$_________', alignment: 'right' }]
                    ]
                },
                layout: 'lightHorizontalLines',
                margin: [0, 0, 0, 15]
            },
            {
                text: 'MONTO NETO RECIBIDO',
                fontSize: 9,
                bold: true,
                decoration: 'underline',
                margin: [0, 5, 0, 5]
            },
            {
                table: {
                    widths: ['60%', '40%'],
                    body: [
                        [{ text: 'Total menos descuentos:', bold: true, color: '#1976D2' },
                        { text: `$_________`, alignment: 'right', bold: true, fontSize: 10, color: '#1976D2' }]
                    ]
                },
                layout: 'lightHorizontalLines',
                margin: [0, 0, 0, 15]
            },
            {
                text: 'FIRMA DE RECIBIDO',
                fontSize: 9,
                bold: true,
                margin: [0, 15, 0, 10]
            },
            {
                text: '________________________________',
                alignment: 'center',
                margin: [0, 0, 0, 5]
            },
            {
                text: 'Firma del Cliente',
                fontSize: 8,
                alignment: 'center',
                margin: [0, 0, 0, 15]
            },
            {
                text: 'CREDI-EXPRESS DE EL SALVADOR\n¡Gracias por su pago puntual!',
                alignment: 'center',
                fontSize: 7,
                italics: true,
                margin: [0, 15, 0, 0]
            }
        ]
    };

    mostrarOpcionesPDF(docDefinition, 'RECIBO DE PAGO', `Recibo_${datosCobro.idCobro}_${Date.now()}`);
}

function generarComprobanteCompleto(movimiento) {
    const fecha = movimiento.fechaPago ? new Date(movimiento.fechaPago) : new Date();
    const fechaFormateada = fecha.toLocaleDateString('es-ES');

    const docDefinition = {
        pageSize: { width: 226.77, height: 'auto' },
        pageMargins: [10, 10, 10, 10],
        defaultStyle: { fontSize: 9 },
        content: [
            {
                text: 'CREDI-EXPRESS DE EL SALVADOR',
                fontSize: 11,
                bold: true,
                alignment: 'center',
                margin: [0, 0, 0, 5]
            },
            {
                text: 'COMPROBANTE DE MOVIMIENTO',
                fontSize: 10,
                bold: true,
                alignment: 'center',
                margin: [0, 0, 0, 10]
            },
            {
                canvas: [{ type: 'line', x1: 0, y1: 0, x2: 206, y2: 0, lineWidth: 1 }],
                margin: [0, 0, 0, 10]
            },
            {
                table: {
                    widths: ['35%', '65%'],
                    body: [
                        [{ text: 'FECHA:', bold: true }, fechaFormateada],
                        [{ text: 'HORA:', bold: true }, movimiento.hora || ''],
                        [{ text: 'MOVIMIENTO:', bold: true }, `#${movimiento.id}`],
                        [{ text: 'TIPO:', bold: true }, movimiento.tipo],
                        [{ text: 'CONCEPTO:', bold: true }, movimiento.concepto || ''],
                        [{ text: 'MÉTODO:', bold: true }, movimiento.tipoPago || 'EFECTIVO'],
                        [{ text: 'GESTOR:', bold: true }, movimiento.usuario || 'Sistema']
                    ]
                },
                layout: 'noBorders',
                margin: [0, 0, 0, 10]
            },
            {
                text: 'CLIENTE',
                fontSize: 9,
                bold: true,
                decoration: 'underline',
                margin: [0, 5, 0, 5]
            },
            {
                table: {
                    widths: ['100%'],
                    body: [
                        [{ text: movimiento.cliente || 'Cliente no especificado', fontSize: 9, bold: true }],
                        ...(movimiento.duiCliente ? [[{ text: `DUI: ${movimiento.duiCliente}` }]] : []),
                        ...(movimiento.telefonoCliente ? [[{ text: `Tel: ${movimiento.telefonoCliente}` }]] : [])
                    ]
                },
                layout: 'noBorders',
                margin: [0, 0, 0, 10]
            },
            {
                table: {
                    widths: ['100%'],
                    body: [
                        [{ text: 'MONTO TOTAL', fontSize: 12, bold: true, alignment: 'center', fillColor: '#e8f5e8' }],
                        [{ text: `$${parseFloat(movimiento.monto).toFixed(2)}`, fontSize: 16, bold: true, color: '#1976D2', alignment: 'center', fillColor: '#e8f5e8' }]
                    ]
                },
                margin: [0, 0, 0, 15]
            },
            ...(movimiento.idPrestamo ? [
                {
                    table: {
                        widths: ['100%'],
                        body: [
                            [{ text: `Préstamo #${movimiento.idPrestamo} - ${movimiento.tipoPrestamo || ''}`, fontSize: 8, alignment: 'center' }]
                        ]
                    },
                    layout: 'noBorders',
                    margin: [0, 10, 0, 15]
                }
            ] : []),
            {
                text: 'DESCUENTOS APLICADOS',
                fontSize: 9,
                bold: true,
                decoration: 'underline',
                margin: [0, 10, 0, 5]
            },
            {
                table: {
                    widths: ['60%', '40%'],
                    body: [
                        [{ text: 'Descuento aplicado:', bold: true }, { text: '$_________', alignment: 'right' }]
                    ]
                },
                layout: 'lightHorizontalLines',
                margin: [0, 0, 0, 15]
            },
            {
                text: 'MONTO NETO RECIBIDO',
                fontSize: 9,
                bold: true,
                decoration: 'underline',
                margin: [0, 5, 0, 5]
            },
            {
                table: {
                    widths: ['60%', '40%'],
                    body: [
                        [{ text: 'Total menos descuentos:', bold: true, color: '#1976D2' },
                        { text: `$_________`, alignment: 'right', bold: true, fontSize: 10, color: '#1976D2' }]
                    ]
                },
                layout: 'lightHorizontalLines',
                margin: [0, 0, 0, 15]
            },
            {
                text: 'FIRMA DE RECIBIDO',
                fontSize: 9,
                bold: true,
                margin: [0, 15, 0, 10]
            },
            {
                text: '________________________________',
                alignment: 'center',
                margin: [0, 0, 0, 5]
            },
            {
                text: 'Firma del Cliente',
                fontSize: 8,
                alignment: 'center',
                margin: [0, 0, 0, 15]
            },
            {
                text: 'CREDI-EXPRESS DE EL SALVADOR\nComprobante oficial',
                alignment: 'center',
                fontSize: 7,
                italics: true,
                margin: [0, 15, 0, 0]
            }
        ]
    };

    mostrarOpcionesPDF(docDefinition, 'COMPROBANTE', `Movimiento_${movimiento.id}_${Date.now()}`);
}

