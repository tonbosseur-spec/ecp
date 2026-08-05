import re

with open('src/pages/AdminActivityFeed.tsx', 'r') as f:
    content = f.read()

# Add quizMagnets to stats state
content = content.replace(
    'newSessions: 0\n  });',
    'newSessions: 0,\n    quizMagnets: 0\n  });'
)

# Initialize quizCount
content = content.replace(
    'let sessCount = 0;\n',
    'let sessCount = 0;\n      let quizCount = 0;\n'
)

# Update quizCount
quiz_result_block = """      if (quizResults) {
        quizCount = quizResults.length;
        quizResults.forEach(qr => {
          mixed.push({
            id: `quiz-${qr.id}`,
            type: 'quiz_result',
            title: 'Nouveau Lead (Quiz Magnet)',
            description: `${qr.participant_name || 'Un visiteur'} a terminé le quiz magnet avec un score de ${qr.score}/${qr.max_score}.`,
            date: qr.created_at,
            icon: <Activity className="w-5 h-5 text-blue-600" />,
            bgColor: 'bg-blue-100',
            link: '/admin/hub'
          });
        });
      }"""

content = re.sub(
    r'      if \(quizResults\) \{.*?\n      \}',
    quiz_result_block,
    content,
    flags=re.DOTALL
)

# Update setStats
content = content.replace(
    'newSessions: sessCount\n      });',
    'newSessions: sessCount,\n        quizMagnets: quizCount\n      });'
)

# Update the grid layout for KPIs
content = content.replace(
    'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6',
    'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6'
)

# Add the new KPI tile
kpi_tile = """        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="bg-rose-50 p-4 rounded-full text-rose-600">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-500">Leads (Quiz Magnet)</p>
            <p className="text-2xl font-black text-gray-900">{stats.quizMagnets}</p>
          </div>
        </div>
      </div>"""

content = content.replace(
    '        </div>\n      </div>\n\n      {/* Timeline with Filters */}',
    '        </div>\n\n' + kpi_tile + '\n\n      {/* Timeline with Filters */}'
)

with open('src/pages/AdminActivityFeed.tsx', 'w') as f:
    f.write(content)
