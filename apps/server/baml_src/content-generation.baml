class SourceChunk {
  id string
  text string
}

enum ExerciseDifficulty {
  EASY
  STANDARD
}

enum SourceChunkId {
  @@dynamic
}

class LearningObjective {
  text string
  source_chunk_ids SourceChunkId[]
}

class QuizQuestion {
  question string
  options string[]
  correct_answer string
  explanation string
  source_chunk_ids SourceChunkId[]
}

class Exercise {
  difficulty ExerciseDifficulty
  prompt string
  expected_answer string
  explanation string
  source_chunk_ids SourceChunkId[]
}

class LessonDraft {
  title string
  summary string
  summary_source_chunk_ids SourceChunkId[]
  objectives LearningObjective[]
  quiz_questions QuizQuestion[]
  exercises Exercise[]
}

function GenerateLessonDraft(source_chunks: SourceChunk[], custom_instructions: string?) -> LessonDraft {
  client MindBridgeModel
  prompt #"
    Bạn là chuyên gia thiết kế học liệu. Chỉ sử dụng thông tin trong các đoạn tài liệu nguồn dưới đây để tạo học liệu tiếng Việt.

    {% if custom_instructions %}
    YÊU CẦU RIÊNG TỪ GIÁO VIÊN (ưu tiên tuân theo, nhưng vẫn chỉ dùng dữ kiện trong tài liệu nguồn):
    {{ custom_instructions }}
    {% endif %}

    Yêu cầu:
    - BẮT BUỘC trả về đủ mọi trường của LessonDraft. Hai trường đầu tiên phải là `title` (chuỗi không rỗng) và `summary` (chuỗi không rỗng).
    - Tạo tiêu đề và tóm tắt bài học rõ ràng, phù hợp với nội dung nguồn.
    - Tạo các mục tiêu học tập có thể quan sát/đánh giá.
    - Tạo ít nhất 10 câu quiz. Mỗi câu có các lựa chọn, một đáp án đúng và lời giải thích.
    - Tạo đúng một bài tập EASY và ít nhất một bài tập STANDARD.
    - Với mọi claim, mục tiêu, câu quiz và bài tập, chỉ liệt kê ID của các source chunk thực sự hỗ trợ nội dung đó.
    - Không tạo dữ kiện, ví dụ hoặc nguồn không có trong tài liệu. Nếu tài liệu thiếu thông tin, hãy diễn đạt thận trọng.
    - Chỉ trả về một object JSON theo đúng định dạng output; không thêm markdown, lời dẫn hoặc giải thích bên ngoài object.
    - Chỉ trích những nguồn quan trọng thôi nếu có quá nhiều > 10 nguồn.

    ĐOẠN TÀI LIỆU NGUỒN:
    {{ source_chunks }}

    {{ ctx.output_format }}
  "#
}
