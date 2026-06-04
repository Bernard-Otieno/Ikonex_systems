CREATE OR REPLACE VIEW student_class_rankings AS
SELECT 
    st.id AS student_id,
    st.admission_number,
    st.first_name,
    st.last_name,
    st.stream_id,
    SUM(COALESCE(s.ca_score, 0) + COALESCE(s.exam_score, 0)) AS total_marks,
    ROUND(COALESCE(AVG(COALESCE(s.ca_score, 0) + COALESCE(s.exam_score, 0)), 0), 2) AS average_score,
    -- Strictly ranks students sequentially within their stream; breaks ties using admission number
    ROW_NUMBER() OVER (
        PARTITION BY st.stream_id 
        ORDER BY SUM(COALESCE(s.ca_score, 0) + COALESCE(s.exam_score, 0)) DESC, st.admission_number ASC
    ) AS class_position
FROM students st
LEFT JOIN scores s ON s.student_id = st.id
GROUP BY st.id, st.admission_number, st.first_name, st.last_name, st.stream_id;