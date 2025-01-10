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
                $('#taskList').append(taskItem);
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
            
            // Adicionar à lista
            $('#taskList').append(taskItem);
            
            // Limpar input e focar novamente
            taskInput.val('').focus();
            
            // Salvar tarefas
            saveTasks();
        }
    }

    function createTaskElement(taskText) {
        const li = $('<li>').addClass('task-item');
        const checkbox = $('<input>')
            .attr('type', 'checkbox')
            .addClass('task-checkbox')
            .click(function() {
                textSpan.toggleClass('completed');
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

        li.append(checkbox, textSpan, deleteBtn);
        return li;
    }

    function saveTasks() {
        const tasks = [];
        $('#taskList li').each(function() {
            tasks.push({
                text: $(this).find('.task-text').text(),
                completed: $(this).find('.task-text').hasClass('completed')
            });
        });
        
        localStorage.setItem('tasks', JSON.stringify(tasks));
    }

    function loadTasks() {
        const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
        tasks.forEach(function(task) {
            const taskItem = createTaskElement(task.text);
            if (task.completed) {
                taskItem.find('.task-checkbox').prop('checked', true);
                taskItem.find('.task-text').addClass('completed');
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
}); 