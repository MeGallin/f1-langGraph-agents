import { StateGraph, START, END } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
} from '@langchain/core/messages';
import { F1LangGraphAdapter } from '../adapters/langGraphAdapter.js';
import { SeasonState, StateUtils } from '../state/schemas.js';
import logger from '../utils/logger.js';

/**
 * F1 Season Analysis Agent
 * Specialized agent for comprehensive F1 season analysis and insights
 */
export class SeasonAnalysisAgent {
  constructor(options = {}) {
    this.model =
      options.model ||
      new ChatOpenAI({
        modelName: process.env.DEFAULT_MODEL || 'gpt-4o',
        temperature: parseFloat(process.env.DEFAULT_TEMPERATURE) || 0.1,
        maxTokens: 4000,
      });

    this.f1Adapter = new F1LangGraphAdapter(options);
    this.tools = null;
    this.graph = null;
    this.initialized = false;

    // Agent configuration
    this.maxIterations = parseInt(process.env.MAX_ITERATIONS) || 10;
    this.timeout = parseInt(process.env.AGENT_TIMEOUT) || 30000;
  }

  /**
   * Initialize the agent
   */
  async initialize() {
    try {
      // Initialize F1 adapter and get tools
      this.tools = await this.f1Adapter.initialize();

      // Build the season analysis workflow
      this.graph = this.buildWorkflow();

      this.initialized = true;
      logger.info('Season Analysis Agent initialized successfully');

      return this;
    } catch (error) {
      logger.error('Failed to initialize Season Analysis Agent', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Build the LangGraph workflow for season analysis
   */
  buildWorkflow() {
    // Use channel-based configuration instead of class
    const workflow = new StateGraph({
      channels: {
        messages: { default: () => [] },
        currentQuery: { default: () => '' },
        selectedSeason: { default: () => null },
        selectedDriver: { default: () => null },
        selectedRace: { default: () => null },
        selectedConstructor: { default: () => null },
        analysisType: { default: () => 'season' },
        results: { default: () => [] },
        insights: { default: () => [] },
        confidence: { default: () => 0 },
        timestamp: { default: () => new Date().toISOString() },
        seasons: { default: () => [] },
        constructorData: { default: () => [] },
        raceResults: { default: () => [] },
        championshipStandings: { default: () => [] },
        trends: { default: () => [] },
        finalResponse: { default: () => '' },
        completedAt: { default: () => null },
      },
    });

    // Add nodes
    workflow.addNode('analyzeQuery', this.analyzeQueryNode.bind(this));
    workflow.addNode('fetchSeasonData', this.fetchSeasonDataNode.bind(this));
    workflow.addNode(
      'analyzeConstructors',
      this.analyzeConstructorsNode.bind(this),
    );
    workflow.addNode('analyzeTrends', this.analyzeTrendsNode.bind(this));
    workflow.addNode('generateInsights', this.generateInsightsNode.bind(this));
    workflow.addNode(
      'synthesizeResults',
      this.synthesizeResultsNode.bind(this),
    );

    // Define workflow edges
    workflow.setEntryPoint('analyzeQuery');
    workflow.addEdge('analyzeQuery', 'fetchSeasonData');
    workflow.addConditionalEdges(
      'fetchSeasonData',
      this.routeSeasonAnalysis.bind(this),
      {
        single_season: 'analyzeConstructors',
        multi_season: 'analyzeTrends',
        end: END,
      },
    );
    workflow.addEdge('analyzeConstructors', 'generateInsights');
    workflow.addEdge('analyzeTrends', 'generateInsights');
    workflow.addEdge('generateInsights', 'synthesizeResults');
    workflow.addEdge('synthesizeResults', END);

    return workflow.compile();
  }

  /**
   * Analyze the user query to determine season analysis approach
   */
  async analyzeQueryNode(state) {
    try {
      const { currentQuery, messages } = state;

      logger.debug('Analyzing season query', { query: currentQuery });

      // Use LLM to extract season information from query
      const analysisPrompt = `
        Analyze this F1 query and extract key information:
        Query: "${currentQuery}"
        
        Determine:
        1. Which season(s) are being asked about?
        2. What type of analysis is requested? (overview, comparison, trends, specific aspects)
        3. Any specific constructors, drivers, or races mentioned?
        
        Respond in JSON format:
        {
          "seasons": [list of years],
          "analysisType": "single_season|multi_season|comparison",
          "specificAspects": ["aspect1", "aspect2"],
          "entities": {
            "drivers": ["driver names"],
            "constructors": ["constructor names"],
            "races": ["race names"]
          }
        }
      `;

      const response = await this.model.invoke([
        new SystemMessage(
          'You are an F1 query analysis expert. Extract structured information from F1 queries.',
        ),
        new HumanMessage(analysisPrompt),
      ]);

      let analysis;
      try {
        analysis = JSON.parse(response.content);
      } catch (parseError) {
        // Fallback to default analysis
        analysis = {
          seasons: [new Date().getFullYear()],
          analysisType: 'single_season',
          specificAspects: ['overview'],
          entities: { drivers: [], constructors: [], races: [] },
        };
      }

      // Update state with analysis results
      const updatedState = {
        ...state,
        seasons: analysis.seasons,
        selectedSeason: analysis.seasons[0] || new Date().getFullYear(),
        analysisType: analysis.analysisType,
      };

      StateUtils.addMessage(updatedState, {
        type: 'system',
        content: `Query analyzed: ${
          analysis.analysisType
        } for seasons ${analysis.seasons.join(', ')}`,
      });

      StateUtils.updateConfidence(updatedState, 0.8);

      return updatedState;
    } catch (error) {
      logger.error('Error in analyzeQueryNode', { error: error.message });
      throw error;
    }
  }

  /**
   * Fetch season data from F1 MCP server
   */
  async fetchSeasonDataNode(state) {
    try {
      const { seasons, selectedSeason } = state;

      logger.debug('Fetching season data', { seasons });

      // Fetch data for each season
      const seasonDataPromises = seasons.map(async (year) => {
        const [races, drivers, constructors, seasonSummary] = await Promise.all(
          [
            this.f1Adapter.f1Client.getRaces(year),
            this.f1Adapter.f1Client.getDrivers(year),
            this.f1Adapter.f1Client.getConstructors(year),
            this.f1Adapter.f1Client.getSeasonSummary(year),
          ],
        );

        return {
          year,
          races,
          drivers,
          constructors,
          summary: seasonSummary,
        };
      });

      const seasonData = await Promise.all(seasonDataPromises);

      // Update state with fetched data
      const updatedState = {
        ...state,
        constructorData: seasonData.map((s) => ({
          year: s.year,
          data: s.constructors,
        })),
        raceResults: seasonData.map((s) => ({ year: s.year, data: s.races })),
      };

      StateUtils.addResult(updatedState, {
        type: 'season_data',
        data: seasonData,
        fetchedAt: new Date().toISOString(),
      });

      StateUtils.addMessage(updatedState, {
        type: 'system',
        content: `Fetched data for ${seasons.length} season(s): ${seasons.join(
          ', ',
        )}`,
      });

      StateUtils.updateConfidence(updatedState, 0.9);

      return updatedState;
    } catch (error) {
      logger.error('Error in fetchSeasonDataNode', { error: error.message });
      throw error;
    }
  }

  /**
   * Analyze constructor performance for single season
   */
  async analyzeConstructorsNode(state) {
    try {
      const { selectedSeason, constructorData } = state;

      logger.debug('Analyzing constructors', { season: selectedSeason });

      // Get detailed constructor standings
      const standings = await this.f1Adapter.f1Client.getConstructorStandings(
        selectedSeason,
      );

      // Analyze constructor performance using LLM
      const analysisPrompt = `
        Analyze the F1 constructor performance for ${selectedSeason}:
        
        Constructor Standings: ${JSON.stringify(standings, null, 2)}
        
        Provide insights on:
        1. Championship battle and competitiveness
        2. Performance trends throughout the season
        3. Notable achievements or disappointments
        4. Technical or strategic advantages
        
        Format as structured analysis with key insights.
      `;

      const response = await this.model.invoke([
        new SystemMessage(
          'You are an F1 technical analyst with deep knowledge of constructor performance and F1 history.',
        ),
        new HumanMessage(analysisPrompt),
      ]);

      const updatedState = {
        ...state,
        championshipStandings: standings,
      };

      StateUtils.addResult(updatedState, {
        type: 'constructor_analysis',
        season: selectedSeason,
        analysis: response.content,
        standings: standings,
      });

      StateUtils.addInsight(updatedState, response.content);
      StateUtils.updateConfidence(updatedState, 0.85);

      return updatedState;
    } catch (error) {
      logger.error('Error in analyzeConstructorsNode', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Analyze trends across multiple seasons
   */
  async analyzeTrendsNode(state) {
    try {
      const { seasons, constructorData, raceResults } = state;

      logger.debug('Analyzing multi-season trends', { seasons });

      // Analyze trends using LLM
      const trendsPrompt = `
        Analyze F1 trends across seasons ${seasons.join(', ')}:
        
        Constructor Data: ${JSON.stringify(constructorData, null, 2)}
        Race Data: ${JSON.stringify(raceResults, null, 2)}
        
        Identify and analyze:
        1. Dominant periods and shifts in competitiveness
        2. Technical regulation impacts
        3. Evolution of team performance
        4. Emerging patterns or cycles
        5. Significant changes in the competitive landscape
        
        Provide comprehensive trend analysis with specific examples.
      `;

      const response = await this.model.invoke([
        new SystemMessage(
          'You are an F1 historian and analyst expert in identifying long-term trends and patterns in Formula 1.',
        ),
        new HumanMessage(trendsPrompt),
      ]);

      const updatedState = {
        ...state,
        trends: [
          {
            seasons: seasons,
            analysis: response.content,
            analyzedAt: new Date().toISOString(),
          },
        ],
      };

      StateUtils.addResult(updatedState, {
        type: 'trend_analysis',
        seasons: seasons,
        analysis: response.content,
      });

      StateUtils.addInsight(updatedState, response.content);
      StateUtils.updateConfidence(updatedState, 0.8);

      return updatedState;
    } catch (error) {
      logger.error('Error in analyzeTrendsNode', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate comprehensive insights
   */
  async generateInsightsNode(state) {
    try {
      const { results, insights, selectedSeason, seasons } = state;

      logger.debug('Generating comprehensive insights');

      // Generate comprehensive insights using all collected data
      const insightPrompt = `
        Generate comprehensive F1 insights based on the analysis:
        
        Season(s): ${seasons.join(', ')}
        Analysis Results: ${JSON.stringify(results, null, 2)}
        Previous Insights: ${insights.map((i) => i.text || i).join('\n')}
        
        Provide:
        1. Key takeaways and highlights
        2. Historical context and significance
        3. Performance implications
        4. Future predictions or expectations
        5. Notable records or achievements
        
        Format as executive summary with bullet points for easy reading.
      `;

      const response = await this.model.invoke([
        new SystemMessage(
          'You are an F1 expert providing executive-level insights and analysis for F1 stakeholders.',
        ),
        new HumanMessage(insightPrompt),
      ]);

      const updatedState = { ...state };

      StateUtils.addResult(updatedState, {
        type: 'comprehensive_insights',
        insights: response.content,
        basedOn: results.length,
      });

      StateUtils.addInsight(updatedState, response.content);
      StateUtils.updateConfidence(updatedState, 0.9);

      return updatedState;
    } catch (error) {
      logger.error('Error in generateInsightsNode', { error: error.message });
      throw error;
    }
  }

  /**
   * Synthesize final results
   */
  async synthesizeResultsNode(state) {
    try {
      const { results, insights, seasons, currentQuery } = state;

      logger.debug('Synthesizing final results');

      // Create final synthesis
      const synthesisPrompt = `
        Create a comprehensive response to this F1 query: "${currentQuery}"
        
        Analysis Results: ${JSON.stringify(results, null, 2)}
        Insights: ${insights.map((i) => i.text || i).join('\n\n')}
        
        Provide a well-structured, informative response that:
        1. Directly answers the original query
        2. Includes relevant data and statistics
        3. Provides expert analysis and context
        4. Is engaging and accessible to F1 fans
        
        Format with clear sections and bullet points where appropriate.
      `;

      const response = await this.model.invoke([
        new SystemMessage(
          'You are creating the final response to an F1 query. Be comprehensive yet accessible, and ensure you directly address what was asked.',
        ),
        new HumanMessage(synthesisPrompt),
      ]);

      const updatedState = {
        ...state,
        finalResponse: response.content,
        completedAt: new Date().toISOString(),
      };

      StateUtils.addMessage(updatedState, {
        type: 'assistant',
        content: response.content,
      });

      StateUtils.updateConfidence(updatedState, 0.95);

      return updatedState;
    } catch (error) {
      logger.error('Error in synthesizeResultsNode', { error: error.message });
      throw error;
    }
  }

  /**
   * Route season analysis based on query type
   */
  routeSeasonAnalysis(state) {
    const { seasons, analysisType } = state;

    if (seasons.length === 1) {
      return 'single_season';
    } else if (seasons.length > 1) {
      return 'multi_season';
    } else {
      return 'end';
    }
  }

  /**
   * Analyze a season query
   */
  async analyze(query, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      logger.info('Starting season analysis', { query });

      const initialState = new SeasonState();
      initialState.currentQuery = query;

      StateUtils.addMessage(initialState, {
        type: 'human',
        content: query,
      });

      // Run the workflow
      const result = await this.graph.invoke(initialState, {
        configurable: {
          thread_id: options.threadId || `season_${Date.now()}`,
          recursion_limit: this.maxIterations,
        },
      });

      logger.info('Season analysis completed', {
        confidence: result.confidence,
        insights: result.insights?.length || 0,
      });

      return result;
    } catch (error) {
      logger.error('Season analysis failed', { error: error.message, query });
      throw error;
    }
  }

  /**
   * Get agent information
   */
  getInfo() {
    return {
      name: 'Season Analysis Agent',
      description:
        'Specialized F1 agent for comprehensive season analysis and insights',
      capabilities: [
        'Single season analysis',
        'Multi-season comparisons',
        'Constructor performance analysis',
        'Performance trends identification',
        'Historical context and insights',
      ],
      initialized: this.initialized,
    };
  }
}

export default SeasonAnalysisAgent;
