let tabla;

$(document).ready(function () {
    // Establecer fechas por defecto al cargar la página
    const today = new Date();
    const yearStart = new Date(today.getFullYear(), 0, 1); // 0 = enero

    // Formato YYYY-MM-DD
    const formatDate = (date) => date.toISOString().split('T')[0];

    $('#txtFechaDesde').val(formatDate(yearStart));
    $('#txtFechaHasta').val(formatDate(today));

    $('#btnFiltrar').on('click', function () {
        const estado = $('#estadoFiltro').val();
        const fechaInicio = $('#txtFechaDesde').val();
        const fechaFin = $('#txtFechaHasta').val();
        const extra = $('#selectExtra').val();
     
        showLoadingSpinner();
        $.ajax({
            url: `/Auxiliares/GetPrestamos?estado=${estado}&fechaInicio=${fechaInicio}&fechaFin=${fechaFin}&extra=${extra}`,
            method: 'GET',
            success: function (data) {
                console.log(data);

                if ($.fn.dataTable.isDataTable('#tblPrestamos')) {
                    $('#tblPrestamos').DataTable().destroy();
                }

                $('#contenedorTabla').show();

                tabla = $('#tblPrestamos').DataTable({
                    language: {
                        url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json'
                    },
                    processing: true,
                    serverSide: false,
                    data: data,
                    dom: 'frtip',
                    "columns": [
                        {
                            "data": "id",
                            "title": "N° Gestion",
                            "className": "tamano2"
                        },
                        {
                            "data": "nombreCliente",
                            "title": "Cliente",
                            "className": "tamano2"
                        },
                        {
                            "data": "estado",
                            "title": "Estado",
                            "className": "tamano1",
                            "render": function (data, type, row, meta) {
                                let estado = data == 'E' ? 'ELIMINADO' : data == 'C' ? 'CANCELADO' : data == 'A' ? 'ACTIVO' : 'INDEFINIDO';
                                return estado;
                            }
                        },
                        {
                            "data": "fecha",
                            "title": "Fecha",
                            "className": "tamano1"
                        },
                        {
                            "data": "monto",
                            "title": "Monto",
                            "className": "tamano1",
                            "render": function (data, type, row, meta) {
                                let monto = parseFloat(data).toFixed(2);
                                return `$ ${monto}`;
                            }
                        },
                        {
                            "data": "tasa",
                            "title": "Tasa",
                            "className": "tamano1",
                            "render": function (data, type, row, meta) {
                                let tasa = parseFloat(data).toFixed(2);
                                return `${tasa} %`;
                            }
                        },
                        {
                            "data": "numCoutas",
                            "title": "Coutas",
                            "className": "tamano1"
                        },                   
                        {
                            "data": null,
                            "title": "Opciones",
                            "className": "dt-body-center tamano1",
                            "render": function (data, type, row, meta) {
                                return `<button type="button" class="btn btn-primary btn-sm" onclick="detalle(${row.id})">
                                         <i class="fas fa-eye"></i>
                                       </button>`;
                            }
                        }                  
                    ],
                    rowCallback: function (row, data, index) {
                        // if (data.activo === true) {
                        //     $(row).css('background-color', '#d1f2eb');
                        // }
                    },
                    initComplete: function () {
                        hideLoadingSpinner();
                    }
                    
                });
            },
            error: function (xhr, status, error) {
                console.error('Error al cargar los préstamos:', error);
                $('#resultadoPrestamos').html('<p class="text-danger">Ocurrió un error al cargar los datos.</p>');
            }
        });
    });

});


