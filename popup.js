document.addEventListener('DOMContentLoaded', function() {
    // Inicializar tema
    initializeTheme();
    
    // Carregar tarefas salvas quando o popup abrir
    loadTasks();

    // Auto-focus no input
    $('#taskInput').focus();

    // Adicionar tarefa quando o botão for clicado
    $('#addTask').click(addTask);

    // Adicionar tarefa quando Enter for pressionado
    $('#taskInput').keypress(function(e) {
        if (e.which == 13) {
            addTask();
        }
    });

    // Suporte para colar múltiplas tarefas
    $('#taskInput').on('paste', function(e) {
        e.preventDefault();
        const pastedText = (e.originalEvent.clipboardData || window.clipboardData).getData('text');
        const tasks = pastedText.split('\n').filter(task => task.trim() !== '');
        
        tasks.forEach(task => {
            if (task.trim()) {
                const taskItem = createTaskElement(task.trim());
                $('#taskList').prepend(taskItem);
            }
        });
        
        if (tasks.length > 0) {
            saveTasks();
            $(this).val('');
        }
    });

    // Toggle do tema
    $('#themeToggle').click(function() {
        const isDark = $('html').attr('data-theme') === 'dark';
        $('html').attr('data-theme', isDark ? 'light' : 'dark');
        localStorage.setItem('theme', isDark ? 'light' : 'dark');
        $(this).find('i').toggleClass('fa-sun fa-moon');
    });

    function addTask() {
        const taskInput = $('#taskInput');
        const taskText = taskInput.val().trim();
        
        if (taskText) {
            // Criar novo item da lista
            const taskItem = createTaskElement(taskText);
            
            // Adicionar ao topo da lista
            $('#taskList').prepend(taskItem);
            
            // Limpar input e focar novamente
            taskInput.val('').focus();
            
            // Salvar tarefas
            saveTasks();
        }
    }

    function createTaskElement(taskText, isSubtask = false) {
        const li = $('<li>')
            .addClass('task-item');
            
        if (!isSubtask) {
            li.attr('draggable', true);
        }

        if (isSubtask) {
            li.addClass('subtask');
        }

        const dragHandle = $('<i>')
            .addClass('fas fa-grip-vertical drag-handle');
            
        const checkbox = $('<input>')
            .attr('type', 'checkbox')
            .addClass('task-checkbox')
            .click(function(e) {
                const isCompleted = $(this).prop('checked');
                textSpan.toggleClass('completed', isCompleted);

                // Se for uma tarefa principal, atualizar todas as subtarefas
                if (!isSubtask) {
                    const subtasks = li.find('.subtask-list .task-checkbox');
                    subtasks.prop('checked', isCompleted);
                    subtasks.each(function() {
                        $(this).closest('.task-item').find('.task-text').toggleClass('completed', isCompleted);
                    });

                    // Disparar confete apenas quando completar (não quando desmarcar)
                    if (isCompleted) {
                        showCompletionAnimation(e);
                    }
                }

                saveTasks();
            });

        const textSpan = $('<span>')
            .addClass('task-text')
            .text(taskText);

        const deleteBtn = $('<button>')
            .addClass('delete-btn')
            .html('<i class="fas fa-trash"></i>')
            .click(function() {
                li.fadeOut(300, function() {
                    li.remove();
                    saveTasks();
                });
            });

        // Adicionar botão de expandir apenas para tarefas principais
        if (!isSubtask) {
            const expandBtn = $('<button>')
                .addClass('expand-btn')
                .html('<i class="fas fa-chevron-right"></i>')
                .click(function() {
                    $(this).toggleClass('expanded');
                    subtasksContainer.toggleClass('expanded');
                });

            // Criar container de subtarefas
            const subtasksContainer = $('<div>')
                .addClass('subtasks-container')
                .append(
                    $('<div>').addClass('input-container')
                        .append(
                            $('<input>')
                                .attr('type', 'text')
                                .attr('placeholder', 'Digite uma subtarefa...')
                                .addClass('subtask-input')
                                .keypress(function(e) {
                                    if (e.which == 13) {
                                        addSubtask($(this));
                                    }
                                })
                        )
                        .append(
                            $('<button>')
                                .text('Adicionar')
                                .click(function() {
                                    addSubtask($(this).prev());
                                })
                        )
                )
                .append($('<ul>').addClass('subtask-list'));

            li.append(dragHandle, expandBtn, checkbox, textSpan, deleteBtn, subtasksContainer);

            // Adicionar eventos de drag and drop apenas para tarefas principais
            li[0].addEventListener('dragstart', handleDragStart);
            li[0].addEventListener('dragend', handleDragEnd);
            li[0].addEventListener('dragover', handleDragOver);
            li[0].addEventListener('drop', handleDrop);
            li[0].addEventListener('dragenter', handleDragEnter);
            li[0].addEventListener('dragleave', handleDragLeave);
        } else {
            li.append(dragHandle, checkbox, textSpan, deleteBtn);
        }

        return li;
    }

    function addSubtask(input) {
        const subtaskText = input.val().trim();
        if (subtaskText) {
            const subtaskItem = createTaskElement(subtaskText, true);
            input.closest('.subtasks-container').find('.subtask-list').append(subtaskItem);
            input.val('').focus();
            saveTasks();
        }
    }

    // Funções de Drag and Drop
    let draggedItem = null;
    let dropIndicator = $('<div>').addClass('drop-indicator');

    function handleDragStart(e) {
        // Não permitir arrastar se for uma subtarefa
        if ($(this).hasClass('subtask')) {
            e.preventDefault();
            return;
        }
        
        draggedItem = this;
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        
        $('.drop-indicator').remove();
    }

    function handleDragEnd(e) {
        this.classList.remove('dragging');
        // Remover o indicador
        $('.drop-indicator').remove();
        draggedItem = null;
    }

    function handleDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        e.dataTransfer.dropEffect = 'move';
        return false;
    }

    function handleDragEnter(e) {
        if (this !== draggedItem) {
            // Remover qualquer indicador existente
            $('.drop-indicator').remove();
            
            // Criar e inserir novo indicador
            const newIndicator = dropIndicator.clone();
            $(this).before(newIndicator);
            newIndicator.addClass('active');
        }
    }

    function handleDragLeave(e) {
        const relatedTarget = e.relatedTarget;
        if (!relatedTarget || !this.contains(relatedTarget)) {
            // Remover o indicador apenas se o mouse sair completamente do item
            $('.drop-indicator').remove();
        }
    }

    function handleDrop(e) {
        e.stopPropagation();
        e.preventDefault();

        if (draggedItem !== this && !$(this).hasClass('subtask')) {
            this.parentNode.insertBefore(draggedItem, this);
            saveTasks();
        }

        $('.drop-indicator').remove();
        return false;
    }

    function saveTasks() {
        const tasks = [];
        $('#taskList > li').each(function() {
            const task = {
                text: $(this).find('> .task-text').text(),
                completed: $(this).find('> .task-text').hasClass('completed'),
                subtasks: []
            };

            // Salvar subtarefas
            $(this).find('.subtask-list > li').each(function() {
                task.subtasks.push({
                    text: $(this).find('.task-text').text(),
                    completed: $(this).find('.task-text').hasClass('completed')
                });
            });

            tasks.push(task);
        });
        
        localStorage.setItem('tasks', JSON.stringify(tasks));
    }

    function loadTasks() {
        const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
        tasks.forEach(function(task) {
            const taskItem = createTaskElement(task.text);
            if (task.completed) {
                taskItem.find('> .task-checkbox').prop('checked', true);
                taskItem.find('> .task-text').addClass('completed');
            }

            // Carregar subtarefas
            if (task.subtasks && task.subtasks.length > 0) {
                const subtaskList = taskItem.find('.subtask-list');
                task.subtasks.forEach(function(subtask) {
                    const subtaskItem = createTaskElement(subtask.text, true);
                    if (subtask.completed) {
                        subtaskItem.find('.task-checkbox').prop('checked', true);
                        subtaskItem.find('.task-text').addClass('completed');
                    }
                    subtaskList.append(subtaskItem);
                });
            }

            $('#taskList').append(taskItem);
        });
    }

    function initializeTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        $('html').attr('data-theme', savedTheme);
        if (savedTheme === 'dark') {
            $('#themeToggle i').removeClass('fa-moon').addClass('fa-sun');
        }
    }

    // Função para mostrar a animação de confete
    function showCompletionAnimation(e) {
        const colors = ["#4CAF50", "#45a049", "#66bb6a", "#81c784"];
        
        const bounds = e.target.getBoundingClientRect();
        const x = bounds.left;
        const y = bounds.top;

        confetti({
            particleCount: 100,
            spread: 70,
            origin: { 
                x: x / window.innerWidth, 
                y: y / window.innerHeight 
            },
            colors: colors,
            ticks: 200,
            gravity: 1.5,
            scalar: 1.2,
            shapes: ["circle", "square"],
            zIndex: 9999
        });
    }
}); 