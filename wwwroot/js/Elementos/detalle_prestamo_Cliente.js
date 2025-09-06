function detalle(id) {
    const modalElement = document.getElementById('detalleClienteModal');
    const modal = new bootstrap.Modal(modalElement);
    mostrarLoading();
    modal.show();

    $(modalElement).one('shown.bs.modal', function () {
        $.ajax({
            url: `/Crud/GetDetallePagosPrestamos?idPrestamo=${id}`,
            method: 'GET',
            success: function (resp) {
                console.log(resp);

                if (resp.success) {
                    const { prestamo, cliente, data: pagosDetalle } = resp;

                    // ===== INFORMACIÓN DEL CLIENTE =====
                    $("#clienteNombreCompleto").html(cliente.nombreCompleto);
                    $("#clienteDui").html(cliente.dui || 'N/A');
                    $("#clienteTelefono").html(cliente.telefono || 'N/A');
                    $("#clienteTelefonoAdicional").html(cliente.telefonoAdicional || 'N/A');
                    $("#clienteDireccion").html(cliente.direccion || 'N/A');
                    $("#clienteEmail").html(cliente.email || 'N/A');
                    $("#clienteOcupacion").html(cliente.ocupacion || 'N/A');

                    // ===== INFORMACIÓN DEL PRÉSTAMO =====
                    $("#prestamoId").html(prestamo.id);
                    $("#prestamoMonto").html(`$ ${parseFloat(prestamo.monto).toFixed(2)}`);
                    $("#prestamoTasaInteres").html(prestamo.tasaInteres ? `${parseFloat(prestamo.tasaInteres).toFixed(2)}%` : 'N/A');
                    $("#prestamoTasaDomiclio").html(prestamo.tasaInteres ? `${parseFloat(prestamo.tasaInteres).toFixed(2)}%` : 'N/A');
                    $("#prestamoCuota").html(`$ ${parseFloat(prestamo.cuota).toFixed(2)}`);
                    $("#prestamoNumCuotas").html(prestamo.numCoutas);
                    $("#prestamoFecha").html(formatearFecha(prestamo.fecha));
                    $("#prestamoProximoPago").html(formatearFecha(prestamo.proximoPago));

                    // Resumen financiero
                    $("#totalPagado").html(`$ ${parseFloat(prestamo.totalPagado).toFixed(2)}`);
                    $("#saldoPendiente").html(`$ ${parseFloat(prestamo.saldoPendiente).toFixed(2)}`);


                    // Estado del préstamo con badge
                    const estadoBadge = obtenerBadgeEstado(prestamo.estado);
                    $("#prestamoEstado").html(estadoBadge);

                    // ===== TABLA DE PAGOS =====

                    if ($.fn.DataTable.isDataTable('#tbPagosDetalles')) {
                        $('#tbPagosDetalles').DataTable().destroy();
                    }

                    $('#tbPagosDetalles').DataTable({
                        data: pagosDetalle,
                        scrollCollapse: true,
                        scrollX: true,
                        scrollY: '200px',
                        paging: false,
                        info: false,
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
                            leftColumns: 2
                        },
                        columns: [
                            {
                                data: "numeroPago",
                                render: d => `<div><small>${d || 'N/A'}</small></div>`
                            },
                            {
                                data: "fechaPago",
                                render: d => `<div><small>${d || 'N/A'}</small></div>`
                            },
                            {
                                data: "montoCouta",
                                render: d => `<div><small>$ ${parseFloat(d || 0).toFixed(2)}</small></div>`
                            },
                            {
                                data: "fechaCouta",
                                render: d => `<div><small>${d || 'N/A'}</small></div>`
                            },
                            {
                                data: "capital",
                                render: d => `<div><small>$ ${parseFloat(d || 0).toFixed(2)}</small></div>`
                            },
                            {
                                data: "interes",
                                render: d => `<div><small>$ ${parseFloat(d || 0).toFixed(2)}</small></div>`
                            },
                            {
                                data: "domicilio",
                                render: d => `<div><small>$ ${parseFloat(d || 0).toFixed(2)}</small></div>`
                            },
                            {
                                data: "tipoPago",
                                render: d => `<div><small>${d || 'Indefinido'}</small></div>`
                            },
                            {
                                data: "tipoMovimiento",
                                render: d => `<div><small>${d || 'Indefinido'}</small></div>`
                            },
                            {
                                data: "diasMora",
                                render: d => `<div><small>${d || 0}</small></div>`
                            },
                            {
                                data: "observaciones",
                                visible: false,
                                render: d => `<div><small>${d || 'N/A'}</small></div>`
                            },
                            {
                                data: "pagado",
                                render: d => `<div><small>${d || false}</small></div>`
                            },
                        ],
                        order: [[0, 'desc']],
                        columnDefs: [
                            { targets: [1], orderable: false } // Columna de acciones
                        ],
                        initComplete: function (settings, json) {
                            ocultarLoading();
                        }
                    });
                } else {
                    ocultarLoading();
                    Swal.fire('Error', 'Error: ' + (resp.message || 'No se pudo cargar la información'), 'error');
                }
            },
            error: function (xhr, status, error) {
                console.error('Error al cargar los préstamos:', error);
                ocultarLoading();
                Swal.fire('Error', 'Error al conectar con el servidor', 'error');
            }
        });
    });
}

// ===== FUNCIONES AUXILIARES =====

// Función para obtener el badge del estado del préstamo
function obtenerBadgeEstado(estado) {
    switch (estado?.toLowerCase()) {
        case 'A':
        case 'DESEMBOLSADO':
            return '<span class="badge bg-success">Activo</span>';
        case 'C':
        case 'pendiente':
            return '<span class="badge bg-warning">Pendiente</span>';
        case 'V':
        case 'vencido':
            return '<span class="badge bg-danger">Vencido</span>';
        case 'C':
        case 'CANCELADO':
        case 'COMPLETO':
            return '<span class="badge bg-primary">Completado</span>';
        case 'E':
        case 'ELIMINADO':
            return '<span class="badge bg-secondary">Eliminado</span>';
        default:
            return '<span class="badge bg-secondary">Desconocido</span>';
    }
}

// Función para formatear fecha
function formatearFecha(fecha) {
    if (!fecha) return 'N/A';
    const fechaObj = new Date(fecha);
    return fechaObj.toLocaleDateString('es-SV', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// Funciones simples para mostrar/ocultar
function mostrarLoading() {
    document.getElementById('loading-overlay-contenido').style.display = 'flex';
    document.getElementById('modal-contenido').style.display = 'none';
}

function ocultarLoading() {
    document.getElementById('loading-overlay-contenido').style.display = 'none';
    document.getElementById('modal-contenido').style.display = 'block';
}

// Limpiar modal al cerrarlo
$(document).on('hidden.bs.modal', '#detalleClienteModal', function () {
    // Limpiar datos
    $('#clienteNombreCompleto, #clienteDui, #clienteTelefono, #prestamoId').html('');

    // Destruir tabla si existe
    if ($.fn.DataTable.isDataTable('#tbPagosDetalles')) {
        $('#tbPagosDetalles').DataTable().destroy();
    }

    // Resetear a estado de loading
    mostrarLoading();
});