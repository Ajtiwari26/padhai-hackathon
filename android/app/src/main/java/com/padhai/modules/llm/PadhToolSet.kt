package com.padhai.modules.llm

import com.google.ai.edge.litertlm.Tool
import com.google.ai.edge.litertlm.ToolParam
import com.google.ai.edge.litertlm.ToolSet

/**
 * PadhToolSet: Defines the native tools available to the Gemma 4 model.
 *
 * NOTE: These methods are placeholders. In LiteRTEngineWrapper, we use 
 * automaticToolCalling = false to intercept these calls and route them 
 * back to the React Native orchestrator for actual execution.
 */
class PadhToolSet : ToolSet {

    @Tool(description = "Search for relevant personal or academic facts from the user's memory.")
    fun search_memory(
        @ToolParam(description = "The specific query or topic to search for.")
        query: String
    ): String = ""

    @Tool(description = "Generate a pedagogical diagram or visual aid for a topic.")
    fun generate_diagram(
        @ToolParam(description = "The topic or concept to visualize.")
        topic: String,
        @ToolParam(description = "Optional type of diagram (e.g. flowchart, concept_map).")
        type: String = "flowchart"
    ): String = ""

    @Tool(description = "Create a quick quiz or set of multiple-choice questions (MCQs) for practice.")
    fun generate_quiz(
        @ToolParam(description = "The topic to generate questions for.")
        topic: String,
        @ToolParam(description = "Number of questions to generate.")
        count: Int = 2
    ): String = ""

    @Tool(description = "Explain a specific concept in detail using pedagogical techniques.")
    fun explain_concept(
        @ToolParam(description = "The name of the concept to explain.")
        concept_name: String
    ): String = ""
}
